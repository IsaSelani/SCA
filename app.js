const { createClient } = window.supabase;
const sb = (window.SUPABASE_URL.startsWith("https://SEU-") || window.SUPABASE_ANON_KEY.startsWith("SUA_"))
  ? null : createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const CENTER = [-22.8980, -49.6320];
let map, markers = [], reports = [], currentFilter = "all", selectedStars = 0, currentUser = null, chart;

const demoReports = [
 {id:"demo-1",title:"Calçada quebrada perto da praça",description:"Trecho irregular dificulta a passagem de cadeiras de rodas e carrinhos.",type:"calçada",priority:"Alta",status:"Em andamento",progress:75,address:"Praça Deputado Leônidas Camarinha",latitude:-22.8988,longitude:-49.6332,created_at:"2026-08-12T10:00:00Z"},
 {id:"demo-2",title:"Faixa de pedestres precisa de manutenção",description:"Sinalização desgastada em uma travessia movimentada.",type:"travessia",priority:"Média",status:"Em análise",progress:25,address:"Av. Tiradentes",latitude:-22.8970,longitude:-49.6300,created_at:"2026-08-25T12:00:00Z"},
 {id:"demo-3",title:"Rampa de acesso funcionando",description:"Ponto positivo de acessibilidade.",type:"ponto positivo",priority:"Baixa",status:"Resolvido",progress:100,address:"Centro",latitude:-22.9000,longitude:-49.6345,created_at:"2026-07-20T09:00:00Z"},
 {id:"demo-4",title:"Obstáculo na calçada",description:"Objeto bloqueando parcialmente a passagem.",type:"obstáculo",priority:"Alta",status:"Pendente",progress:0,address:"Rua Conselheiro Dantas",latitude:-22.8956,longitude:-49.6351,created_at:"2026-09-01T14:00:00Z"},
 {id:"demo-5",title:"Piso tátil incompleto",description:"Trecho de orientação tátil precisa ser complementado.",type:"acessibilidade",priority:"Média",status:"Em andamento",progress:50,address:"Rua Catarina Etsuko Umezu",latitude:-22.9011,longitude:-49.6295,created_at:"2026-08-30T15:00:00Z"}
];

document.addEventListener("DOMContentLoaded", async ()=>{
  document.getElementById("menuToggle").onclick=()=>document.getElementById("mainNav").classList.toggle("open");
  document.querySelectorAll("nav a").forEach(a=>a.onclick=()=>document.getElementById("mainNav").classList.remove("open"));
  initMap(); bindFilters(); bindForms(); bindAuth();
  await loadReports(); renderStats(); renderChart();
  if(sb) sb.channel("public-reports").on("postgres_changes",{event:"*",schema:"public",table:"reports"},async()=>{await loadReports();renderStats();renderChart(); if(currentUser) renderDashboard();}).subscribe();
});

function initMap(){
 map=L.map("map").setView(CENTER,14);
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:'© OpenStreetMap contributors'}).addTo(map);
}

async function loadReports(){
 if(sb){const {data,error}=await sb.from("reports").select("*").order("created_at",{ascending:false}); reports=error?demoReports:(data||[]); if(error) console.warn(error)}
 else reports=demoReports;
 renderMarkers(); renderDashboard();
}
function markerColor(r){if(r.status==="Resolvido")return "#718078";if(r.progress>=50)return "#2477c5";if(r.priority==="Alta")return "#ed7b28";return "#16834a"}
function renderMarkers(){
 markers.forEach(m=>map.removeLayer(m)); markers=[];
 const filtered=reports.filter(matchesFilters);
 filtered.forEach(r=>{
   if(r.latitude==null||r.longitude==null)return;
   const icon=L.divIcon({className:"custom-marker",html:`<span style="background:${markerColor(r)}"></span>`,iconSize:[22,22],iconAnchor:[11,11]});
   const m=L.marker([r.latitude,r.longitude],{icon}).addTo(map);
   m.bindPopup(popupHTML(r));markers.push(m);
 });
}
function matchesFilters(r){
 const cat=currentFilter;
 const categoryOK=cat==="all" || (cat==="resolvido"?r.status==="Resolvido":String(r.type||"").toLowerCase()===cat);
 const p=document.getElementById("priorityFilter").value, s=document.getElementById("statusFilter").value;
 return categoryOK&&(p==="all"||r.priority===p)&&(s==="all"||r.status===s);
}
function popupHTML(r){
 return `<div class="popup"><b>${esc(r.title)}</b><p>${esc(r.description||"")}</p><small>${esc(r.type)} • ${esc(r.priority)}</small><p><b>Status:</b> ${esc(r.status)}</p><div class="progress"><i style="width:${r.progress||0}%"></i></div><p><b>${r.progress||0}% concluído</b></p><small>${esc(r.address||"")}</small></div>`;
}
function bindFilters(){
 document.querySelectorAll("#categoryFilters .chip").forEach(b=>b.onclick=()=>{document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));b.classList.add("active");currentFilter=b.dataset.filter;renderMarkers()});
 ["priorityFilter","statusFilter"].forEach(id=>document.getElementById(id).onchange=renderMarkers);
}
function bindForms(){
 document.getElementById("useLocation").onclick=()=>navigator.geolocation?.getCurrentPosition(pos=>{latitude.value=pos.coords.latitude.toFixed(6);longitude.value=pos.coords.longitude.toFixed(6);map.setView([pos.coords.latitude,pos.coords.longitude],16);toast("Localização preenchida.")},()=>toast("Não foi possível obter sua localização."));
 document.getElementById("reportForm").onsubmit=submitReport;
 document.querySelectorAll(".stars button").forEach(b=>b.onclick=()=>{selectedStars=+b.dataset.star;document.querySelectorAll(".stars button").forEach(x=>x.classList.toggle("selected",+x.dataset.star<=selectedStars))});
 document.getElementById("feedbackForm").onsubmit=submitFeedback;
 document.getElementById("modalClose").onclick=()=>document.getElementById("reportModal").classList.add("hidden");
}
async function submitReport(e){
 e.preventDefault(); const f=new FormData(e.target);
 const lat=parseFloat(f.get("latitude")), lon=parseFloat(f.get("longitude"));
 if(!Number.isFinite(lat)||!Number.isFinite(lon)){document.getElementById("reportMessage").textContent="Informe latitude e longitude ou use sua localização.";return}
 const row={title:f.get("title"),description:f.get("description"),type:f.get("type"),priority:f.get("priority"),status:"Pendente",progress:0,address:f.get("address"),latitude:lat,longitude:lon,created_by:currentUser?.id||null};
 if(sb){
   const {data,error}=await sb.from("reports").insert(row).select().single();
   if(error){document.getElementById("reportMessage").textContent="Não foi possível registrar. Verifique a configuração do Supabase e as políticas RLS.";return}
   if(f.get("photo")?.size) await uploadPhoto(data.id,f.get("photo"));
 } else {row.id="local-demo-"+Date.now();row.created_at=new Date().toISOString();reports.unshift(row);renderMarkers();renderStats()}
 e.target.reset();document.getElementById("reportMessage").textContent="Problema registrado com sucesso! A Prefeitura irá analisar a ocorrência.";
 toast("Ocorrência registrada.");
}
async function uploadPhoto(id,file){
 if(!sb)return; const path=`reports/${id}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi,"_")}`;
 const {error}=await sb.storage.from("report-photos").upload(path,file,{upsert:false});
 if(error)return; const {data}=sb.storage.from("report-photos").getPublicUrl(path); await sb.from("reports").update({photo_url:data.publicUrl}).eq("id",id);
}
async function submitFeedback(e){
 e.preventDefault(); if(!selectedStars){document.getElementById("feedbackMessage").textContent="Escolha uma avaliação de 1 a 5 estrelas.";return}
 const f=new FormData(e.target), row={nome:f.get("name"),mensagem:f.get("message"),avaliação:selectedStars};
 if(sb){const {error}=await sb.from("feedback").insert(row);if(error){document.getElementById("feedbackMessage").textContent="Não foi possível enviar o feedback.";return}}
 e.target.reset();selectedStars=0;document.querySelectorAll(".stars button").forEach(x=>x.classList.remove("selected"));document.getElementById("feedbackMessage").textContent="Obrigado pelo feedback!";
}
function renderStats(){
 const total=reports.length,pending=reports.filter(r=>r.status==="Pendente").length,prog=reports.filter(r=>r.status==="Em andamento").length,res=reports.filter(r=>r.status==="Resolvido").length;
 statTotal.textContent=total;statPending.textContent=pending;statProgress.textContent=prog;statResolved.textContent=res;
}
function renderChart(){
 const counts={calçada:0,obstáculo:0,acessibilidade:0,travessia:0,sinalização:0,"ponto positivo":0,outro:0};
 reports.forEach(r=>counts[String(r.type).toLowerCase()]!==undefined&&counts[String(r.type).toLowerCase()]++);
 if(chart)chart.destroy(); chart=new Chart(document.getElementById("reportsChart"),{type:"bar",data:{labels:Object.keys(counts),datasets:[{label:"Ocorrências",data:Object.values(counts),borderWidth:1}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}});
}
function bindAuth(){
 document.getElementById("loginForm").onsubmit=async e=>{e.preventDefault();if(!sb){loginMessage.textContent="Configure o Supabase em js/config.js para ativar o login.";return}
 const f=new FormData(e.target), {data,error}=await sb.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});
 if(error){loginMessage.textContent="E-mail ou senha inválidos.";return}
 currentUser=data.user; await checkRole(); };
 document.getElementById("logout").onclick=async()=>{if(sb)await sb.auth.signOut();currentUser=null;showLogin()};
 if(sb) sb.auth.getSession().then(async({data})=>{if(data.session){currentUser=data.session.user;await checkRole()}});
}
async function checkRole(){
 const {data,error}=await sb.from("profiles").select("role,nome").eq("id",currentUser.id).single();
 if(error||!["prefeitura","admin"].includes(data.role)){await sb.auth.signOut();loginMessage.textContent="Este usuário não possui acesso à área da Prefeitura.";return}
 adminLogin.classList.add("hidden");dashboard.classList.remove("hidden");renderDashboard();
}
function showLogin(){adminLogin.classList.remove("hidden");dashboard.classList.add("hidden")}
function renderDashboard(){
 if(!currentUser)return;
 const a=reports.filter(r=>r.status==="Em análise").length,p=reports.filter(r=>r.status==="Em andamento").length,res=reports.filter(r=>r.status==="Resolvido").length;
 dReceived.textContent=reports.length;dAnalysis.textContent=a;dProgress.textContent=p;dResolved.textContent=res;dAverage.textContent=(reports.length?Math.round(reports.reduce((s,r)=>s+(+r.progress||0),0)/reports.length):0)+"%";
 reportsTable.innerHTML=reports.map(r=>`<tr><td><b>${esc(r.title)}</b></td><td>${esc(r.type)}</td><td>${esc(r.address||"—")}</td><td>${esc(r.priority)}</td><td>${esc(r.status)}</td><td><div class="mini-progress"><div class="progress"><i style="width:${r.progress||0}%"></i></div><span>${r.progress||0}%</span></div></td><td>${new Date(r.created_at).toLocaleDateString("pt-BR")}</td><td><button class="manage-btn" onclick="manageReport('${r.id}')">Gerenciar</button></td></tr>`).join("");
}
window.manageReport=async id=>{
 const r=reports.find(x=>x.id===id);if(!r)return;
 document.getElementById("modalContent").innerHTML=`<span class="eyebrow">GERENCIAR OCORRÊNCIA</span><h2>${esc(r.title)}</h2><div class="modal-grid"><div class="modal-full"><b>Descrição</b><p>${esc(r.description||"—")}</p></div><div><b>Endereço</b><p>${esc(r.address||"—")}</p></div><div><b>Categoria</b><p>${esc(r.type)}</p></div><label>Status<select id="editStatus"><option>Pendente</option><option>Em análise</option><option>Em andamento</option><option>Resolvido</option><option>Rejeitado</option></select></label><label>Andamento <span id="progressValue">${r.progress||0}%</span><input id="editProgress" type="range" min="0" max="100" value="${r.progress||0}"></label><div class="modal-full"><div class="progress"><i id="modalProgress" style="width:${r.progress||0}%"></i></div></div></div><div class="timeline"><div class="${r.progress>=0?"active":""}">●<br>Problema recebido</div><div class="${r.progress>=25?"active":""}">●<br>Prefeitura analisou</div><div class="${r.progress>=50?"active":""}">●<br>Serviço encaminhado</div><div class="${r.progress>=75?"active":""}">●<br>Conserto em andamento</div><div class="${r.progress>=100?"active":""}">●<br>Resolvido</div></div><button class="btn btn-primary" id="saveEdit">Salvar alterações</button><small id="editMessage" class="form-message"></small>`;
 editStatus.value=r.status;
 editProgress.oninput=()=>{progressValue.textContent=editProgress.value+"%";modalProgress.style.width=editProgress.value+"%"};
 saveEdit.onclick=async()=>{let progress=+editProgress.value,status=editStatus.value;if(progress===100)status="Resolvido";else if(progress>=50&&status!=="Rejeitado")status="Em andamento";else if(progress>0&&status!=="Rejeitado")status="Em análise";if(sb){const {error}=await sb.from("reports").update({status,progress,updated_at:new Date().toISOString()}).eq("id",id);if(error){editMessage.textContent="Erro ao salvar. Verifique as políticas RLS.";return}}else{r.status=status;r.progress=progress;r.updated_at=new Date().toISOString();renderMarkers();renderStats();renderDashboard()}editMessage.textContent="Ocorrência atualizada com sucesso.";toast("Ocorrência atualizada.");setTimeout(()=>{document.getElementById("reportModal").classList.add("hidden")},700)};
 document.getElementById("reportModal").classList.remove("hidden");
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}

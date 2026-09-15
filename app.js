let db = null;
let currentUser = null;
let currentProfile = null;
let reports = [];
let map = null;
let markers = [];
let selectingLocation = false;
let authSignup = false;

const CENTER = [-22.899, -49.633];

const colors = {
  calcada:"#ef6259",
  obstaculo:"#ee9344",
  acessibilidade:"#c7d83f",
  travessia:"#4d9de0",
  sinalizacao:"#9b70c8",
  outro:"#9b70c8"
};

document.addEventListener("DOMContentLoaded", async () => {

  if(
    SUPABASE_URL.includes("COLE_A") ||
    SUPABASE_ANON_KEY.includes("COLE_A")
  ){
    showToast("Configure o Supabase em js/config.js");
    return;
  }

  db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  document.getElementById("loginBtn")
    .addEventListener("click", openAuth);

  document.getElementById("logoutBtn")
    .addEventListener("click", logout);

  document.getElementById("authForm")
    .addEventListener("submit", submitAuth);

  document.getElementById("toggleAuthMode")
    .addEventListener("click", toggleAuthMode);

  document.getElementById("reportForm")
    .addEventListener("submit", submitReport);

  const {
    data:{session}
  } = await db.auth.getSession();

  await updateSession(session);

  db.auth.onAuthStateChange(async (_event, session) => {
    await updateSession(session);
  });
});


async function updateSession(session){

  currentUser = session?.user || null;
  currentProfile = null;

  if(currentUser){

    const {data} = await db
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    currentProfile = data || {
      nome:currentUser.email,
      role:"user"
    };
  }

  updateInterface();

  if(currentUser){
    await loadReports();
  }
}


function updateInterface(){

  const logged = !!currentUser;

  document.getElementById("loginBtn")
    .classList.toggle("hidden", logged);

  document.getElementById("logoutBtn")
    .classList.toggle("hidden", !logged);

  document.getElementById("userName").textContent =
    logged
      ? `Olá, ${currentProfile?.nome || currentUser.email}`
      : "";

  document.getElementById("loginMapMessage")
    .classList.toggle("hidden", logged);

  document.getElementById("mapContent")
    .classList.toggle("hidden", !logged);

  const staff =
    logged &&
    ["prefeitura","admin"].includes(currentProfile?.role);

  document.getElementById("staffLoginMessage")
    .classList.toggle("hidden", staff);

  document.getElementById("adminPanel")
    .classList.toggle("hidden", !staff);

  if(logged){

    setTimeout(() => {
      initMap();

      if(map){
        map.invalidateSize();
      }
    },100);

    loadReports();
  }
}


function initMap(){

  if(map) return;

  map = L.map("map").setView(CENTER,14);

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:"© OpenStreetMap contributors"
    }
  ).addTo(map);

 map.on("click", async function (e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;

    // Preenche latitude e longitude
    const latitudeInput = document.getElementById("latitude");
    const longitudeInput = document.getElementById("longitude");
    const localInput = document.getElementById("local");

    if (latitudeInput) {
        latitudeInput.value = lat.toFixed(6);
    }

    if (longitudeInput) {
        longitudeInput.value = lon.toFixed(6);
    }

    // Coloca/move o marcador
    if (marcadorSelecionado) {
        marcadorSelecionado.setLatLng(e.latlng);
    } else {
        marcadorSelecionado = L.marker(e.latlng).addTo(map);
    }

    // Mensagem enquanto procura o endereço
    if (localInput) {
        localInput.value = "Buscando endereço...";
    }

    try {
        const resposta = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
        );

        if (!resposta.ok) {
            throw new Error("Não foi possível consultar o endereço.");
        }

        const dados = await resposta.json();

        if (dados && dados.address) {
            const endereco = dados.address;

            const rua =
                endereco.road ||
                endereco.pedestrian ||
                endereco.footway ||
                endereco.path ||
                "";

            const numero = endereco.house_number || "";

            let textoEndereco = rua;

            if (numero) {
                textoEndereco += `, ${numero}`;
            }

            if (!textoEndereco) {
                textoEndereco = dados.display_name || "Endereço não encontrado";
            }

            if (localInput) {
                localInput.value = textoEndereco;
            }

            if (typeof mostrarToast === "function") {
                mostrarToast("📍 Endereço localizado automaticamente!");
            }
        } else {
            if (localInput) {
                localInput.value = "Endereço não encontrado";
            }
        }

    } catch (erro) {
        console.error("Erro ao buscar endereço:", erro);

        if (localInput) {
            localInput.value = "";
            localInput.placeholder = "Digite o endereço manualmente";
        }

        if (typeof mostrarToast === "function") {
            mostrarToast("Não foi possível localizar a rua. Digite o endereço.");
        }
    }

    // Leva o usuário até o formulário
    const problemaForm = document.getElementById("problema");

    if (problemaForm) {
        problemaForm.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
});
}


async function loadReports(){

  if(!db || !currentUser) return;

  const {data,error} = await db
    .from("reports")
    .select("*")
    .order("created_at",{ascending:false});

  if(error){
    console.error(error);
    showToast("Não foi possível carregar os problemas.");
    return;
  }

  reports = data || [];

  renderMap();
  updateStatistics();
  renderAdmin();
}


function renderMap(){

  if(!map) return;

  markers.forEach(m => map.removeLayer(m));
  markers = [];

  const filtered = getFilteredReports();

  filtered.forEach(report => {

    if(
      report.latitude === null ||
      report.longitude === null
    ) return;

    const color =
      colors[report.type] || colors.outro;

    const icon = L.divIcon({
      className:"",
      html:`
        <div style="
          width:18px;
          height:18px;
          border-radius:50%;
          background:${color};
          border:3px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,.3)
        "></div>
      `,
      iconSize:[18,18],
      iconAnchor:[9,9]
    });

    const marker = L.marker(
      [report.latitude,report.longitude],
      {icon}
    ).addTo(map);

    marker.bindPopup(reportPopup(report));

    markers.push(marker);
  });
}


function reportPopup(report){

  const progress = Number(report.progress || 0);

  return `
    <div style="min-width:220px">

      <h3>${escapeHtml(report.title)}</h3>

      <p>
        <strong>Categoria:</strong>
        ${escapeHtml(report.type)}
      </p>

      <p>
        <strong>Prioridade:</strong>
        ${escapeHtml(report.priority)}
      </p>

      <p>
        <strong>Status:</strong>
        ${escapeHtml(report.status)}
      </p>

      <p>
        <strong>Andamento:</strong>
        ${progress}%
      </p>

      <div style="
        height:8px;
        background:#e8ece5;
        border-radius:10px;
        overflow:hidden
      ">
        <div style="
          width:${progress}%;
          height:100%;
          background:#81951c
        "></div>
      </div>

      <p>
        ${escapeHtml(report.description)}
      </p>

      <p>
        📍 ${escapeHtml(report.address)}
      </p>

      ${
        report.photo_url
        ? `<img src="${escapeAttribute(report.photo_url)}"
             style="width:100%;border-radius:10px;margin-top:8px">`
        :""
      }

      ${
        progress === 100
        ? "<strong>✅ Problema resolvido</strong>"
        :""
      }

    </div>
  `;
}


function filterReports(type){

  window.currentCategory = type;

  renderMap();
}


function getFilteredReports(){

  let result = [...reports];

  const category = window.currentCategory;

  if(category && category !== "todos"){

    if(category === "resolvido"){
      result = result.filter(r =>
        r.status === "Resolvido" ||
        Number(r.progress) === 100
      );
    }else{
      result = result.filter(r =>
        r.type === category
      );
    }
  }

  const priority =
    document.getElementById("filterPriority")?.value;

  const status =
    document.getElementById("filterStatus")?.value;

  if(priority){
    result = result.filter(r =>
      r.priority === priority
    );
  }

  if(status){
    result = result.filter(r =>
      r.status === status
    );
  }

  return result;
}


function applyFilters(){
  renderMap();
}


function useLocation(){

  if(!navigator.geolocation){
    showToast("Seu navegador não possui localização.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {

      document.getElementById("latitude").value =
        position.coords.latitude.toFixed(6);

      document.getElementById("longitude").value =
        position.coords.longitude.toFixed(6);

      showToast("Localização obtida.");

      if(map){
        map.setView([
          position.coords.latitude,
          position.coords.longitude
        ],17);
      }
    },
    () => {
      showToast("Não foi possível obter sua localização.");
    }
  );
}


function chooseLocation(){

  if(!currentUser){
    openAuth();
    return;
  }

  document.getElementById("mapa")
    .scrollIntoView({behavior:"smooth"});

  selectingLocation = true;

  showToast("Clique no mapa para escolher o local.");

  if(map){
    setTimeout(() => map.invalidateSize(),300);
  }
}


async function submitReport(e){

  e.preventDefault();

  if(!currentUser){
    openAuth();
    return;
  }

  const title =
    document.getElementById("title").value.trim();

  const description =
    document.getElementById("description").value.trim();

  const type =
    document.getElementById("type").value;

  const priority =
    document.getElementById("priority").value;

  const address =
    document.getElementById("address").value.trim();

  const latitude =
    Number(document.getElementById("latitude").value);

  const longitude =
    Number(document.getElementById("longitude").value);

  if(!Number.isFinite(latitude) ||
     !Number.isFinite(longitude)){

    showToast("Informe uma localização válida.");
    return;
  }

  let photoUrl = null;

  const photo =
    document.getElementById("photo").files[0];

  if(photo){

    const extension =
      photo.name.split(".").pop();

    const path =
      `${currentUser.id}/${crypto.randomUUID()}.${extension}`;

    const {error} = await db.storage
      .from("report-photos")
      .upload(path,photo);

    if(error){
      console.error(error);
      showToast("Erro ao enviar a foto.");
      return;
    }

    const {data} = db.storage
      .from("report-photos")
      .getPublicUrl(path);

    photoUrl = data.publicUrl;
  }

  const {error} = await db
    .from("reports")
    .insert({
      title,
      description,
      type,
      priority,
      status:"Pendente",
      progress:0,
      address,
      latitude,
      longitude,
      photo_url:photoUrl,
      created_by:currentUser.id
    });

  if(error){
    console.error(error);
    showToast("Não foi possível registrar o problema.");
    return;
  }

  document.getElementById("reportForm").reset();

  showToast(
    "Problema registrado com sucesso! A Prefeitura irá analisar a ocorrência."
  );

  await loadReports();

  document.getElementById("mapa")
    .scrollIntoView({behavior:"smooth"});
}


function updateStatistics(){

  const total = reports.length;

  const pending =
    reports.filter(r => r.status === "Pendente").length;

  const progress =
    reports.filter(r =>
      r.status === "Em andamento" ||
      (Number(r.progress) > 0 &&
       Number(r.progress) < 100)
    ).length;

  const resolved =
    reports.filter(r =>
      r.status === "Resolvido" ||
      Number(r.progress) === 100
    ).length;

  document.getElementById("totalReports").textContent = total;
  document.getElementById("pendingReports").textContent = pending;
  document.getElementById("progressReports").textContent = progress;
  document.getElementById("resolvedReports").textContent = resolved;
}


function renderAdmin(){

  const staff =
    currentProfile &&
    ["prefeitura","admin"].includes(currentProfile.role);

  if(!staff) return;

  const analysis =
    reports.filter(r => r.status === "Em análise").length;

  const progress =
    reports.filter(r => r.status === "Em andamento").length;

  const resolved =
    reports.filter(r => r.status === "Resolvido").length;

  const average =
    reports.length
      ? Math.round(
          reports.reduce(
            (sum,r)=>sum + Number(r.progress || 0),0
          ) / reports.length
        )
      : 0;

  document.getElementById("adminTotal").textContent =
    reports.length;

  document.getElementById("adminAnalysis").textContent =
    analysis;

  document.getElementById("adminProgress").textContent =
    progress;

  document.getElementById("adminResolved").textContent =
    resolved;

  document.getElementById("adminAverage").textContent =
    `${average}%`;

  const table =
    document.getElementById("adminTable");

  table.innerHTML = "";

  reports.forEach(report => {

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHtml(report.title)}</td>

      <td>${escapeHtml(report.type)}</td>

      <td>${escapeHtml(report.priority)}</td>

      <td>
        <span class="status">
          ${escapeHtml(report.status)}
        </span>
      </td>

      <td>
        <div class="progress">
          <div style="width:${Number(report.progress || 0)}%"></div>
        </div>

        <small>${Number(report.progress || 0)}%</small>
      </td>

      <td>
        <button class="action-btn"
          onclick="openManage('${report.id}')">
          Gerenciar
        </button>
      </td>
    `;

    table.appendChild(tr);
  });
}


function openManage(id){

  const report =
    reports.find(r => r.id === id);

  if(!report) return;

  document.getElementById("manageContent").innerHTML = `

    ${
      report.photo_url
      ? `<img class="manage-photo"
              src="${escapeAttribute(report.photo_url)}">`
      :""
    }

    <div class="report-detail">
      <h3>${escapeHtml(report.title)}</h3>

      <p>${escapeHtml(report.description)}</p>

      <p>📍 ${escapeHtml(report.address)}</p>

      <p>
        Categoria:
        <strong>${escapeHtml(report.type)}</strong>
      </p>

      <p>
        Prioridade:
        <strong>${escapeHtml(report.priority)}</strong>
      </p>
    </div>

    <div class="manage-grid">

      <label>
        Status

        <select id="manageStatus">
          <option ${report.status==="Pendente"?"selected":""}>
            Pendente
          </option>

          <option ${report.status==="Em análise"?"selected":""}>
            Em análise
          </option>

          <option ${report.status==="Em andamento"?"selected":""}>
            Em andamento
          </option>

          <option ${report.status==="Resolvido"?"selected":""}>
            Resolvido
          </option>

          <option ${report.status==="Rejeitado"?"selected":""}>
            Rejeitado
          </option>
        </select>
      </label>

      <label>
        Andamento (%)

        <input
          id="manageProgress"
          type="number"
          min="0"
          max="100"
          value="${Number(report.progress || 0)}">
      </label>

    </div>

    <button class="btn btn-primary full"
      onclick="saveManage('${report.id}')">
      Salvar alterações
    </button>
  `;

  document.getElementById("manageModal")
    .classList.remove("hidden");
}


function closeManage(){
  document.getElementById("manageModal")
    .classList.add("hidden");
}


async function saveManage(id){

  if(
    !currentProfile ||
    !["prefeitura","admin"].includes(currentProfile.role)
  ){
    showToast("Você não possui permissão.");
    return;
  }

  let status =
    document.getElementById("manageStatus").value;

  let progress =
    Math.max(
      0,
      Math.min(
        100,
        Number(document.getElementById("manageProgress").value)
      )
    );

  if(progress === 100){
    status = "Resolvido";
  }else if(progress >= 50){
    status = "Em andamento";
  }else if(progress > 0){
    status = "Em análise";
  }

  const {error} = await db
    .from("reports")
    .update({
      status,
      progress,
      updated_at:new Date().toISOString()
    })
    .eq("id",id);

  if(error){
    console.error(error);
    showToast("Não foi possível salvar.");
    return;
  }

  closeManage();

  showToast("Problema atualizado.");

  await loadReports();
}


function openAuth(){

  authSignup = false;

  document.getElementById("authModal")
    .classList.remove("hidden");

  updateAuthModal();
}


function closeAuth(){

  document.getElementById("authModal")
    .classList.add("hidden");
}


function toggleAuthMode(){

  authSignup = !authSignup;

  updateAuthModal();
}


function updateAuthModal(){

  document.getElementById("authTitle").textContent =
    authSignup ? "Criar conta" : "Entrar";

  document.getElementById("authDescription").textContent =
    authSignup
      ? "Crie sua conta para participar."
      : "Entre para participar do Santa Cruz Acessível.";

  document.getElementById("authNameField")
    .classList.toggle("hidden",!authSignup);

  document.getElementById("authSubmitText").textContent =
    authSignup ? "Criar conta" : "Entrar";

  document.getElementById("toggleAuthMode").textContent =
    authSignup
      ? "Já tenho uma conta"
      : "Criar uma conta";

  document.getElementById("authMessage").textContent = "";
}


async function submitAuth(e){

  e.preventDefault();

  const email =
    document.getElementById("authEmail").value.trim();

  const password =
    document.getElementById("authPassword").value;

  const name =
    document.getElementById("authName").value.trim();

  const message =
    document.getElementById("authMessage");

  message.textContent = "Aguarde...";

  if(authSignup){

    const {data,error} =
      await db.auth.signUp({
        email,
        password,
        options:{
          data:{nome:name}
        }
      });

    if(error){
      message.textContent = error.message;
      return;
    }

    if(data.user){

      if(data.session){
        closeAuth();
        showToast("Conta criada com sucesso.");
      }else{
        message.textContent =
          "Conta criada. Verifique seu e-mail para confirmar o cadastro.";
      }
    }

  }else{

    const {error} =
      await db.auth.signInWithPassword({
        email,
        password
      });

    if(error){
      message.textContent =
        "E-mail ou senha incorretos.";
      return;
    }

    closeAuth();

    showToast("Login realizado.");
  }
}


async function logout(){

  if(db){
    await db.auth.signOut();
  }

  currentUser = null;
  currentProfile = null;
  reports = [];

  if(map){
    markers.forEach(m => map.removeLayer(m));
    markers = [];
  }

  updateInterface();

  showToast("Você saiu da conta.");
}


function requireLogin(section){

  if(!currentUser){
    openAuth();
    return;
  }

  document.getElementById(section)
    .scrollIntoView({behavior:"smooth"});
}


function showToast(text){

  const toast =
    document.getElementById("toast");

  toast.textContent = text;
  toast.style.display = "block";

  clearTimeout(window.toastTimer);

  window.toastTimer =
    setTimeout(()=>{
      toast.style.display = "none";
    },4000);
}


function escapeHtml(value){

  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}


function escapeAttribute(value){
  return escapeHtml(value);
}

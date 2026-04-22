// ==========================================
// VARIÁVEIS GLOBAIS E ESTRUTURA
// ==========================================
let cena, camara, renderizador, controlos;
let diametroArame = 6;
let RaioCurvatura = 15;  

let diametroRoleteNivelCima = 30;
let diametroRoletePreto = 20; 
let distanciaRoletePreto = 28;

// NOVOS GRUPOS DA MÁQUINA (Árvore Cinemática)
let grupoMaquinaCompleta = new THREE.Group(); 
let grupoBraco = new THREE.Group();        
let grupoCorte = new THREE.Group();        
let grupoCarroFixo = new THREE.Group();    
let grupoCarroMovel = new THREE.Group();   
let grupoFerramenta = new THREE.Group();   

let malhasMaquina = [];
let memoriaCNC = []; 
let arameVisivel = null; 
let arameSimulacao = null; 

let simulandoVideo = false;
let isPaused = false; 

// AFINAÇÕES PERFEITAS DA MÁQUINA
window.ALTURA_REPOUSO = -30; // Máquina recolhida
window.ALTURA_ENCAIXE = -12; // Altura certa para morder o arame
const DISTANCIA_CORTE = 200; // Arame comprido até à guilhotina

// POSIÇÕES DO CARRO VERDE (EIXO R) PARA O CÓDIGO NC E 3D
window.AFINACAO_R_DIR = -40;  // Afastamento físico para dobras à Direita (+90º)
window.AFINACAO_R_ESQ = -6.5; // Afastamento físico para dobras à Esquerda (-90º)
window.VARREDURA_PRETO = 0.85; // 85% do grau total para não esmagar o arame

// Coordenadas Fixas da Ferramenta
const AFINACAO_FERRAMENTA_Y = 0; 
const AFINACAO_FERRAMENTA_Z = 0; 

window.DrawObject = function() {};
window.DrawObjectWithAnimation = function() {};

// ==========================================
// 1. ARRANQUE DA INTERFACE E INJEÇÃO DE UI
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    
    // Injeta os novos campos de Ferramenta no Menu Inicial
    let menuInicial = document.getElementById('menu-inicial');
    if (menuInicial && !document.getElementById('input-rolete-preto')) {
        let htmlFerramentas = `
            <div style="margin-top:15px; margin-bottom: 15px; border-top:1px solid #30363d; padding-top:15px;">
                <label style="display:block; color:#8b949e; font-size:12px; margin-bottom:5px;">DIÂMETRO DO ROLETE NÍVEL CIMA (MM):</label>
                <input type="number" id="input-rolete-nivel-cima" value="30" style="width:100%; padding:10px; background:#0d1117; border:1px solid #30363d; color:#c9d1d9; border-radius:4px; margin-bottom:10px; outline:none;">
                
                <label style="display:block; color:#8b949e; font-size:12px; margin-bottom:5px;">DIÂMETRO DO ROLETE PRETO (MM):</label>
                <input type="number" id="input-rolete-preto" value="20" style="width:100%; padding:10px; background:#0d1117; border:1px solid #30363d; color:#c9d1d9; border-radius:4px; margin-bottom:10px; outline:none;">
                
                <label style="display:block; color:#8b949e; font-size:12px; margin-bottom:5px;">DISTÂNCIA DO ROLETE PRETO AO CENTRO (MM):</label>
                <input type="number" id="input-distancia-preto" value="28" style="width:100%; padding:10px; background:#0d1117; border:1px solid #30363d; color:#c9d1d9; border-radius:4px; outline:none;">
            </div>
        `;
        let btnIniciar = document.getElementById('btn-iniciar');
        if(btnIniciar) {
            let divExtra = document.createElement('div');
            divExtra.innerHTML = htmlFerramentas;
            btnIniciar.parentNode.insertBefore(divExtra, btnIniciar);
        }
    }

    const btnIniciar = document.getElementById('btn-iniciar'); 
    if(btnIniciar) {
        btnIniciar.addEventListener('click', function() {
            const inputD = document.getElementById('input-diametro');
            if (inputD) diametroArame = parseFloat(inputD.value);
            
            const inputC = document.getElementById('input-curvatura');
            if (inputC) {
                let diametroMatriz = parseFloat(inputC.value);
                if (diametroMatriz > 30) {
                    alert("Aviso: O diâmetro da matriz não pode ultrapassar os 30 mm!");
                    inputC.value = 30; 
                    return; 
                }
                RaioCurvatura = diametroMatriz / 2;
            }

            const inputRNC = document.getElementById('input-rolete-nivel-cima');
            if (inputRNC) diametroRoleteNivelCima = parseFloat(inputRNC.value) || 30;

            const inputRP = document.getElementById('input-rolete-preto');
            if (inputRP) diametroRoletePreto = parseFloat(inputRP.value) || 20;

            const inputDistP = document.getElementById('input-distancia-preto');
            if (inputDistP) distanciaRoletePreto = parseFloat(inputDistP.value) || 28;
            
            document.getElementById('menu-inicial').style.display = 'none';
            document.getElementById('simulador-container').style.display = 'flex';
            setTimeout(iniciar3D, 50);
        });
    }

    document.getElementById('btn-adicionar').onclick = window.ExecutarAdicionar;
    document.getElementById('btn-corte').onclick = window.ExecutarCorte;
    document.getElementById('btn-play').onclick = window.ExecutarPlay;
    document.getElementById('btn-limpar').onclick = window.ExecutarLimpar;

    const btnPause = document.getElementById('btn-pause');
    if(btnPause) {
        btnPause.onclick = function() {
            if (!simulandoVideo) return; 
            isPaused = !isPaused; 
            if (isPaused) {
                this.innerHTML = "▶ CONTINUAR";
                this.style.background = "#4CAF50"; 
            } else {
                this.innerHTML = "⏸ PAUSA";
                this.style.background = "#607d8b"; 
            }
        };
    }

    let listaComandos = document.getElementById('lista-comandos');
    if (listaComandos) {
        let painelStats = document.createElement('div');
        painelStats.className = 'painel-estatisticas';
        
        painelStats.innerHTML = `
            <div class="painel-titulo" style="color:#3fb950; margin-bottom:10px;">ESTATÍSTICAS & MÁQUINA</div>
            <div class="stat-item">Arame: <span id="arame-total" class="stat-valor">0.00</span> mm</div>
            <div class="stat-item" style="margin-bottom:15px;">Tempo Real: <span id="tempo-total" class="stat-valor">0m 0s</span></div>
            
            <div style="border-top: 1px solid #238636; padding-top: 12px; margin-top: 10px;">
                <div style="font-size: 11px; color: #8b949e; margin-bottom: 8px; font-weight:bold;">VELOCIDADES DOS EIXOS REAIS</div>
                <div style="display: flex; gap: 5px; margin-bottom: 3px;">
                    <div style="flex: 1; text-align: center;">
                        <input type="number" id="v-x" value="100" min="1" step="10" style="width: 100%; background: #0d1117; color: #c9d1d9; border: 1px solid #30363d; border-radius:4px; padding: 5px; font-size: 13px; font-weight:bold; text-align: center; outline:none;">
                        <div style="font-size: 9px; color: #8b949e; margin-top:4px;">X (mm/s)</div>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <input type="number" id="v-y" value="150" min="1" step="10" style="width: 100%; background: #0d1117; color: #c9d1d9; border: 1px solid #30363d; border-radius:4px; padding: 5px; font-size: 13px; font-weight:bold; text-align: center; outline:none;">
                        <div style="font-size: 9px; color: #8b949e; margin-top:4px;">Y (º/s)</div>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <input type="number" id="v-z" value="180" min="1" step="10" style="width: 100%; background: #0d1117; color: #c9d1d9; border: 1px solid #30363d; border-radius:4px; padding: 5px; font-size: 13px; font-weight:bold; text-align: center; outline:none;">
                        <div style="font-size: 9px; color: #8b949e; margin-top:4px;">Z (º/s)</div>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <input type="number" id="v-u" value="60" min="1" step="5" style="width: 100%; background: #0d1117; color: #c9d1d9; border: 1px solid #30363d; border-radius:4px; padding: 5px; font-size: 13px; font-weight:bold; text-align: center; outline:none;">
                        <div style="font-size: 9px; color: #8b949e; margin-top:4px;">U (mm/s)</div>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <input type="number" id="v-r" value="80" min="1" step="5" style="width: 100%; background: #0d1117; color: #c9d1d9; border: 1px solid #30363d; border-radius:4px; padding: 5px; font-size: 13px; font-weight:bold; text-align: center; outline:none;">
                        <div style="font-size: 9px; color: #8b949e; margin-top:4px;">R (mm/s)</div>
                    </div>
                </div>
            </div>
        `;
        listaComandos.parentNode.insertBefore(painelStats, listaComandos);

        ['v-x', 'v-y', 'v-z', 'v-u', 'v-r'].forEach(id => {
            document.getElementById(id).addEventListener('input', atualizarEstatisticas);
        });
    }

    let painelSimulacao = document.getElementById('painel-simulacao');
    let btnPlayDOM = document.getElementById('btn-play');
    
    if (painelSimulacao && btnPlayDOM) {
        let divVel = document.createElement('div');
        divVel.style.marginBottom = '20px';
        divVel.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <span style="font-size:13px; color:#8b949e; font-weight:bold;">ACELERAÇÃO VISUAL (VÍDEO)</span>
                <span id="vel-val" style="font-size:14px; color:#f78166; font-weight:bold;">2x</span>
            </div>
            <input type="range" id="input-velocidade" class="slider-vel" min="1" max="10" step="0.5" value="2">
        `;
        painelSimulacao.insertBefore(divVel, btnPlayDOM.parentNode);
        document.getElementById('input-velocidade').addEventListener('input', function(e) {
            document.getElementById('vel-val').innerText = e.target.value + 'x';
        });

        let painelFicheiros = document.createElement('div');
        painelFicheiros.style.marginTop = '20px';
        painelFicheiros.style.paddingTop = '15px';
        painelFicheiros.style.borderTop = '1px solid #30363d';
        
        painelFicheiros.innerHTML = `
            <div class="painel-titulo">Gestão de Ficheiros</div>
            <input type="text" id="input-nome-ficheiro" value="projeto_arame" style="width:100%; padding:12px; background:#0d1117; border:1px solid #30363d; color:#4CAF50; font-weight:bold; border-radius:6px; margin-bottom:10px; font-size:14px; outline:none;">
            <input type="file" id="input-importar" accept=".json,.txt" style="display:none;">
        `;
        
        let divBotoesProj = document.createElement('div');
        divBotoesProj.style.display = 'flex';
        divBotoesProj.style.gap = '10px';
        divBotoesProj.style.marginBottom = '10px';
        
        let btnGuardarProj = document.createElement('button');
        btnGuardarProj.className = 'btn-verde';
        btnGuardarProj.style.flex = '1';
        btnGuardarProj.innerHTML = '💾 Guardar Projeto';
        btnGuardarProj.onclick = window.ExecutarGuardarProjeto;
        divBotoesProj.appendChild(btnGuardarProj);

        let btnImportarProj = document.createElement('button');
        btnImportarProj.className = 'btn-azul';
        btnImportarProj.style.flex = '1';
        btnImportarProj.innerHTML = '📂 Abrir Projeto';
        btnImportarProj.onclick = function() { document.getElementById('input-importar').click(); };
        divBotoesProj.appendChild(btnImportarProj);
        
        painelFicheiros.appendChild(divBotoesProj);

        let btnExportarNC = document.createElement('button');
        btnExportarNC.className = 'btn-vermelho';
        btnExportarNC.style.width = '100%';
        btnExportarNC.innerHTML = '⚙️ Exportar Código NC (Máquina)';
        btnExportarNC.onclick = window.ExecutarExportarNC;
        painelFicheiros.appendChild(btnExportarNC);

        painelSimulacao.appendChild(painelFicheiros);
        document.getElementById('input-importar').addEventListener('change', window.ExecutarImportarProjeto);
    }
});

// ==========================================
// FUNÇÃO DE TEMPO (FÍSICA REAL)
// ==========================================
function atualizarEstatisticas() {
    let totalArame = 0;
    let tempoTotal = 0; 
    let simR_stat = 0; 
    let simRotBase_stat = 0;

    memoriaCNC.forEach(cmd => {
        if (cmd.tipo === 'corte') {
            tempoTotal += 1.5; 
            simR_stat = 0; simRotBase_stat = 0; 
        } else {
            let avanco = cmd.x || 0; 
            let dobra = Math.abs(cmd.d || 0);
            
            let raioCentro = RaioCurvatura + (diametroArame / 2);
            totalArame += (avanco + (dobra * Math.PI / 180) * raioCentro);

            let vx = cmd.vx || parseFloat(document.getElementById('v-x')?.value) || 100;
            let vy = cmd.vy || parseFloat(document.getElementById('v-y')?.value) || 150;
            let vz = cmd.vz || parseFloat(document.getElementById('v-z')?.value) || 180;
            let vu = cmd.vu || parseFloat(document.getElementById('v-u')?.value) || 60;
            let vr = cmd.vr || parseFloat(document.getElementById('v-r')?.value) || 80;

            if (cmd.x !== 0) tempoTotal += Math.abs(cmd.x) / vx;
            if (cmd.z !== 0) tempoTotal += Math.abs(cmd.z) / vz;
            
            if (cmd.d !== 0) {
                let dir = Math.sign(cmd.d);
                let targetR = (dir > 0) ? window.AFINACAO_R_DIR : window.AFINACAO_R_ESQ; 
                let startRotBase = (dir > 0) ? 90 : -90; 

                if (simR_stat !== targetR || simRotBase_stat !== startRotBase) {
                    let tempoR = Math.abs(targetR - simR_stat) / vr;
                    let tempoY = Math.abs(startRotBase - simRotBase_stat) / vy;
                    tempoTotal += Math.max(tempoR, tempoY);
                    simR_stat = targetR;
                    simRotBase_stat = startRotBase;
                }
                tempoTotal += 20 / vu; 
                let anguloTrabalho = Math.abs(cmd.d * window.VARREDURA_PRETO);
                tempoTotal += (anguloTrabalho / vy) * 2; 
                tempoTotal += 20 / vu;
            }
        }
    });

    const arameEl = document.getElementById('arame-total');
    const tempoEl = document.getElementById('tempo-total');
    if(arameEl) arameEl.innerText = Math.max(0, totalArame).toFixed(2);
    if(tempoEl) {
        let minutos = Math.floor(tempoTotal / 60);
        let segundos = Math.floor(tempoTotal % 60);
        tempoEl.innerText = `${minutos}m ${segundos}s`;
    }
}

// ==========================================
// 2. MOTOR 3D E MONTAGEM DA MÁQUINA
// ==========================================
function iniciar3D() {
    const contentor3D = document.getElementById('ecra-3d');
    cena = new THREE.Scene(); cena.background = new THREE.Color('#0d1117'); 
    const gridHelper = new THREE.GridHelper(2000, 40, 0x30363d, 0x161b22);
    gridHelper.position.y = -350;
    cena.add(gridHelper);

    camara = new THREE.PerspectiveCamera(60, contentor3D.clientWidth / contentor3D.clientHeight, 10, 1000000);
    camara.position.set(200, 200, 300);

    renderizador = new THREE.WebGLRenderer({ antialias: true }); 
    renderizador.setSize(contentor3D.clientWidth, contentor3D.clientHeight);
    contentor3D.appendChild(renderizador.domElement);

    controlos = new THREE.OrbitControls(camara, renderizador.domElement);
    controlos.target.set(0, 0, 0); controlos.update();

    cena.add(new THREE.AmbientLight(0xffffff, 0.7)); 
    let luz1 = new THREE.DirectionalLight(0xffffff, 0.6); luz1.position.set(1000, 2000, 1000); cena.add(luz1);
    let luz2 = new THREE.DirectionalLight(0xffffff, 0.4); luz2.position.set(-1000, -1000, 1000); cena.add(luz2);

    const bolaDobra = new THREE.Mesh(new THREE.SphereGeometry(3, 32, 32), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    bolaDobra.position.set(AFINACAO_FERRAMENTA_Z, AFINACAO_FERRAMENTA_Y, 0); 
    cena.add(bolaDobra);

    cena.add(grupoMaquinaCompleta); 
    grupoMaquinaCompleta.add(grupoBraco);
    grupoMaquinaCompleta.add(grupoCorte);
    grupoMaquinaCompleta.add(grupoCarroFixo);
    grupoCarroFixo.add(grupoCarroMovel);
    grupoCarroMovel.add(grupoFerramenta);

    // MÁQUINA FIXADA NOS -408
    grupoMaquinaCompleta.rotation.set(-Math.PI / 2, 0, 0); 
    grupoMaquinaCompleta.position.set(-408, -30, 0); 

    const matAcoEscuro = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.8 });
    const matMetalBrilhante = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.3, metalness: 0.9 });
    const carregadorSTL = new THREE.STLLoader();

    function carregarPecaComCores(nomeFicheiro, grupoPai, eFerramentaGiratoria = false) {
        const mtlLoader = new THREE.MTLLoader();
        mtlLoader.load('./modelos/' + nomeFicheiro + '.mtl', function (materiais) {
            materiais.preload();
            const objLoader = new THREE.OBJLoader();
            objLoader.setMaterials(materiais); 
            objLoader.load('./modelos/' + nomeFicheiro + '.obj', function (obj) {
                obj.scale.set(1, 1, 1); 
                if (eFerramentaGiratoria) {
                    let caixa = new THREE.Box3().setFromObject(obj);
                    let centro = caixa.getCenter(new THREE.Vector3());
                    // Pivô de rotação = centro do rolete nível (não o centro da bbox do OBJ)
                    let pivot = new THREE.Vector3(centro.x, centro.y, centro.z + ALTURA_BASE_ROLETES);
                    obj.position.sub(pivot);
                    grupoPai.position.copy(pivot);
                }
                obj.traverse(function (child) {
                    if (child.isMesh) { malhasMaquina.push(child); }
                });
                grupoPai.add(obj); 
            });
        });
    }

    carregarPecaComCores('estrutura', grupoBraco);
    carregarPecaComCores('FerramentaCorte', grupoCorte);
    carregarPecaComCores('PecaEsquerdaDireita', grupoCarroFixo);
    carregarPecaComCores('PecaCimaBaixo', grupoCarroMovel);
    carregarPecaComCores('FerramentaDobrar', grupoFerramenta, true);

    const ALTURA_BASE_ROLETES = 20; 

    // ROLETES ESCALADOS PELOS VALORES DA UI
    carregadorSTL.load('./modelos/STL/RoleteNivel.STL', (geo) => { 
        let mesh = new THREE.Mesh(geo, matMetalBrilhante); 
        let escalaMatriz = (RaioCurvatura * 2) / 30;
        mesh.scale.set(escalaMatriz, 1, escalaMatriz);
        mesh.rotation.set(-Math.PI / 2, 0, 0); 
        mesh.position.set(0, 0, 0); // pivô = centro do rolete nível
        grupoFerramenta.add(mesh); 
    });

    carregadorSTL.load('./modelos/STL/RoleteNivel.STL', (geo) => { 
        let mesh = new THREE.Mesh(geo, matAcoEscuro); 
        let escalaCima = diametroRoleteNivelCima / 30;
        mesh.scale.set(escalaCima, 1, escalaCima); 
        mesh.rotation.set(-Math.PI / 2, 0, 0); 
        mesh.position.set(0, 0, 8); // 8 acima do rolete nível base
        grupoFerramenta.add(mesh); 
    });

    carregadorSTL.load('./modelos/STL/RoleteDobrar.STL', (geo) => { 
        geo.rotateX(Math.PI / 2); geo.rotateY(Math.PI / 2); 
        let mesh = new THREE.Mesh(geo, matAcoEscuro); 
        let escalaRolete = diametroRoletePreto / 20; 
        mesh.scale.set(escalaRolete, 1, escalaRolete); 
        mesh.position.set(distanciaRoletePreto, 0, 4); // 4 acima do rolete nível
        grupoFerramenta.add(mesh); 
    });

    atualizarCenaCAD(); 
    animar();

    window.addEventListener('resize', () => {
        if(!camara || !renderizador) return;
        camara.aspect = contentor3D.clientWidth / contentor3D.clientHeight;
        camara.updateProjectionMatrix();
        renderizador.setSize(contentor3D.clientWidth, contentor3D.clientHeight);
    }, false);
}

function animar() {
    requestAnimationFrame(animar);
    if(controlos) controlos.update(); 
    if(renderizador) renderizador.render(cena, camara); 
}

// ==========================================
// 3. FÍSICA DO ARAME (LÓGICA INVERTIDA A PEDIDO)
// ==========================================
function getDiametroSeguro() { return (typeof diametroArame !== 'undefined' && diametroArame > 0) ? (diametroArame / 1.5) : 4; }

class BendCurve extends THREE.Curve {
    constructor(raio, arc, dir) { super(); this.raio = raio; this.arc = arc; this.dir = dir; }
    getPoint(t, optionalTarget = new THREE.Vector3()) {
        let a = t * this.arc;
        let x = this.raio * Math.sin(a);
        let z = this.dir * this.raio * (1 - Math.cos(a));
        return optionalTarget.set(x, 0, z);
    }
}

function preProcessCommands(comandos) {
    let res = [];
    let consumir = DISTANCIA_CORTE; 
    for (let c of comandos) {
        if (c.tipo === 'corte') continue;
        let newCmd = { ...c };
        
        if (newCmd.x && consumir > 0) {
            if (newCmd.x > 0) {
                let deduct = Math.min(newCmd.x, consumir);
                newCmd.x -= deduct;
                consumir -= deduct;
            }
        }
        res.push(newCmd);
    }
    return { cmds: res, tailLength: DISTANCIA_CORTE - consumir };
}

function gerarArame(comandos, incluirBaseInfinita = true) {
    let mat = new THREE.MeshPhongMaterial({ color: 0x8ab4f8, shininess: 100 }); 
    let root = new THREE.Group(); 
    let raioCentro = RaioCurvatura + (diametroArame / 2); 
    let d = getDiametroSeguro();

    let proc = preProcessCommands(comandos);
    let tailLength = proc.tailLength;
    let segmentCounter = 0; 

    for (let i = 0; i < proc.cmds.length; i++) {
        let cmd = proc.cmds[i];

        if (cmd.x !== 0) {
            let gX = new THREE.Group();
            if (cmd.x > 0.001) { 
                let cil = new THREE.Mesh(new THREE.CylinderGeometry(d, d, Math.abs(cmd.x), 36), mat);
                cil.rotation.z = Math.PI / 2; cil.position.x = cmd.x / 2;
                cil.userData.segmentIndex = segmentCounter++; 
                gX.add(cil);
            }
            let wrapper = new THREE.Group();
            wrapper.position.x = cmd.x;
            wrapper.add(root);
            gX.add(wrapper); 
            root = gX;
        }

        if (cmd.z !== 0) {
            let gZ = new THREE.Group();
            let wrapper = new THREE.Group();
            wrapper.rotation.x = -cmd.z * Math.PI / 180;
            wrapper.add(root);
            gZ.add(wrapper); 
            root = gZ;
        }

        if (cmd.d !== 0) {
            let arc = (Math.abs(cmd.d) * Math.PI) / 180; 
            let dirVisual = Math.sign(cmd.d); 
            let gD = new THREE.Group();
            
            if (arc > 0.001) { 
                let path = new BendCurve(raioCentro, arc, dirVisual);
                let curvaMesh = new THREE.Mesh(new THREE.TubeGeometry(path, 30, d, 32, false), mat);
                curvaMesh.userData.segmentIndex = segmentCounter++; 
                gD.add(curvaMesh);
            }

            let wrapper = new THREE.Group();
            wrapper.position.set(raioCentro * Math.sin(arc), 0, dirVisual * raioCentro * (1 - Math.cos(arc)));
            wrapper.rotation.y = -dirVisual * arc; 
            wrapper.add(root);
            gD.add(wrapper); 
            root = gD;
        }
    }
    
    let modeloFinal = new THREE.Group();
    modeloFinal.add(root); 

    if (tailLength > 0) {
        let tail = new THREE.Mesh(new THREE.CylinderGeometry(d, d, tailLength, 36), mat);
        tail.rotation.z = Math.PI / 2;
        tail.position.x = -DISTANCIA_CORTE + (tailLength / 2); 
        tail.userData.segmentIndex = -1;
        modeloFinal.add(tail);
    }

    if (incluirBaseInfinita) {
        let baseInfinita = new THREE.Mesh(new THREE.CylinderGeometry(d, d, 900, 36), mat);
        baseInfinita.rotation.z = Math.PI / 2; 
        baseInfinita.position.x = -DISTANCIA_CORTE - 450; 
        baseInfinita.userData.segmentIndex = -2;
        modeloFinal.add(baseInfinita);
    }
    
    return modeloFinal;
}

// ==========================================
// 4. MODO CAD E MODO CAM
// ==========================================
function atualizarCenaCAD() {
    if (simulandoVideo) return;
    if (arameVisivel) { cena.remove(arameVisivel); arameVisivel = null; }
    if (arameSimulacao) { cena.remove(arameSimulacao); arameSimulacao = null; }

    arameVisivel = gerarArame(memoriaCNC, true);
    arameVisivel.position.set(AFINACAO_FERRAMENTA_Z, AFINACAO_FERRAMENTA_Y, 0); 
    
    let totalZ = 0;
    for(let c of memoriaCNC) {
        if(c.tipo === 'corte') totalZ = 0;
        else totalZ += (c.z || 0);
    }
    arameVisivel.rotation.x = (totalZ * Math.PI) / 180;
    cena.add(arameVisivel);

    // Reset à máquina
    grupoCorte.position.z = 0;                    
    grupoCarroMovel.position.z = window.ALTURA_REPOUSO;  
    grupoCarroFixo.position.y = 0;               
    grupoFerramenta.rotation.z = 0;               
    simRotBase = 0;
}

function atualizarCenaSimulacaoFrame(cmdsFrame, posZ, posU, posY, posR) {
    if (!simulandoVideo) return;
    if (arameSimulacao) cena.remove(arameSimulacao);

    arameSimulacao = gerarArame(cmdsFrame, true);
    arameSimulacao.position.set(AFINACAO_FERRAMENTA_Z, AFINACAO_FERRAMENTA_Y, 0); 
    arameSimulacao.rotation.x = (posZ * Math.PI) / 180;
    cena.add(arameSimulacao);

    // Movimento 3D da Máquina
    grupoCarroMovel.position.z = posU; 
    grupoCarroFixo.position.y = posR; 
    grupoFerramenta.rotation.z = (posY * Math.PI) / 180; 
}

function lerInputsSeguro() {
    let getVal = (ids) => { for (let id of ids) { let el = document.getElementById(id); if (el && el.value !== "") return parseFloat(el.value) || 0; } return 0; };
    return { 
        tipo: 'movimento', 
        x: getVal(['input-x']), 
        z: getVal(['input-z']), 
        d: getVal(['input-d']),
        vx: parseFloat(document.getElementById('v-x')?.value) || 100,
        vy: parseFloat(document.getElementById('v-y')?.value) || 150,
        vz: parseFloat(document.getElementById('v-z')?.value) || 180,
        vu: parseFloat(document.getElementById('v-u')?.value) || 60,
        vr: parseFloat(document.getElementById('v-r')?.value) || 80
    };
}
function limparCaixasHTML() { ['input-x', 'input-z', 'input-d'].forEach(id => { let el = document.getElementById(id); if (el) el.value = 0; }); }

function validarAcessoDobragem(cmd) {
    if (cmd.d === 0 && cmd.z === 0) return true; 

    let sumX = 0;
    let lastCutIndex = -1;
    for(let i = memoriaCNC.length - 1; i >= 0; i--) {
        if (memoriaCNC[i].tipo === 'corte') { lastCutIndex = i; break; }
    }
    for(let i = lastCutIndex + 1; i < memoriaCNC.length; i++) {
        let c = memoriaCNC[i];
        if (c.tipo === 'movimento') sumX += c.x || 0;
        if (c.d !== 0 || c.z !== 0) return true; 
    }
    
    if (sumX + (cmd.x || 0) < 85) {
        alert("⚠️ AVISO DE SEGURANÇA:\nA guilhotina de corte está longe.\nPara poder dobrar ou rodar o arame, tem de programar primeiro um Avanço (X) suficiente!");
        return false;
    }
    return true;
}

// ==========================================
// 5. O CÉREBRO DA SIMULAÇÃO (FÍSICA ESPELHADA)
// ==========================================

async function esperar(ms) {
    while (isPaused) await new Promise(resolve => setTimeout(resolve, 100));
    await new Promise(resolve => setTimeout(resolve, ms));
    while (isPaused) await new Promise(resolve => setTimeout(resolve, 100));
}

let simZ = 0, simR = 0, simRotBase = 0; 

async function simularPassoCNC(cmdTarget, memoriaAteAgora) {
    let cmdTemp = { tipo: 'movimento', x:0, y:0, z:0, u:0, r:0, d:0 };
    let cmdsFrame = [...memoriaAteAgora, cmdTemp];
    let speedEl = document.getElementById('input-velocidade');
    let multi = speedEl ? parseFloat(speedEl.value) : 2; 

    let stepY = Math.max(0.1, 150 * (16/1000) * multi);
    let stepR = Math.max(0.1, 80 * (16/1000) * multi);
    let stepZ = Math.max(0.1, 180 * (16/1000) * multi);
    let stepX = Math.max(0.1, 100 * (16/1000) * multi);

    if (cmdTarget.z !== 0) {
        let maxZ = Math.abs(cmdTarget.z);
        for(let i=stepZ; i<=maxZ; i+=stepZ) {
            cmdTemp.z = i * Math.sign(cmdTarget.z);
            atualizarCenaSimulacaoFrame(cmdsFrame, simZ + cmdTemp.z, window.ALTURA_REPOUSO, simRotBase, simR);
            await esperar(16);
        }
        cmdTemp.z = cmdTarget.z;
        atualizarCenaSimulacaoFrame(cmdsFrame, simZ + cmdTarget.z, window.ALTURA_REPOUSO, simRotBase, simR);
    }
    simZ += cmdTarget.z;

    if (cmdTarget.x !== 0) {
        let maxX = Math.abs(cmdTarget.x);
        for(let i=stepX; i<=maxX; i+=stepX) {
            cmdTemp.x = i * Math.sign(cmdTarget.x);
            atualizarCenaSimulacaoFrame(cmdsFrame, simZ, window.ALTURA_REPOUSO, simRotBase, simR);
            await esperar(16);
        }
        cmdTemp.x = cmdTarget.x;
        atualizarCenaSimulacaoFrame(cmdsFrame, simZ, window.ALTURA_REPOUSO, simRotBase, simR);
    }

    if (cmdTarget.d !== 0) {
        let dir = Math.sign(cmdTarget.d);
        
        let targetR = (dir > 0) ? window.AFINACAO_R_DIR : window.AFINACAO_R_ESQ; 
        let startRotBase = (dir > 0) ? 90 : -90; 

        if (Math.abs(targetR - simR) > 0 || Math.abs(startRotBase - simRotBase) > 0) {
            let steps = 15;
            for(let i=1; i<=steps; i++) {
                atualizarCenaSimulacaoFrame(cmdsFrame, simZ, window.ALTURA_REPOUSO, simRotBase + ((startRotBase - simRotBase) * (i/steps)), simR + ((targetR - simR) * (i/steps))); 
                await esperar(16);
            }
            simR = targetR; simRotBase = startRotBase;
        }
        
        // 3. SOBE
        let distU = Math.abs(window.ALTURA_ENCAIXE - window.ALTURA_REPOUSO);
        let stepsU = 15;
        for(let i=1; i<=stepsU; i++) { 
            let u = window.ALTURA_REPOUSO + (distU * (i / stepsU));
            atualizarCenaSimulacaoFrame(cmdsFrame, simZ, u, simRotBase, simR); await esperar(16);
        }
        
        // 4. DOBRAGEM EFETIVA 
        let endRotBase = dir * (90 - Math.abs(cmdTarget.d) * window.VARREDURA_PRETO); 
        let totalRotacao = endRotBase - startRotBase; 
        
        let stepsDobra = Math.max(1, Math.ceil(Math.abs(totalRotacao) / stepY));
        for(let i=1; i<=stepsDobra; i++) {
            let progresso = i / stepsDobra;
            cmdTemp.d = cmdTarget.d * progresso; 
            atualizarCenaSimulacaoFrame(cmdsFrame, simZ, window.ALTURA_ENCAIXE, startRotBase + (totalRotacao * progresso), simR); 
            await esperar(16);
        }
        cmdTemp.d = cmdTarget.d; 
        simRotBase = endRotBase;
        await esperar(200); 

        // 5. Alivio (Springback)
        let springback = -dir * 15;
        for(let i=1; i<=5; i++) {
            atualizarCenaSimulacaoFrame(cmdsFrame, simZ, window.ALTURA_ENCAIXE, simRotBase + (springback * (i/5)), simR); await esperar(16);
        }
        simRotBase += springback;

        // 6. DESCE
        for(let i=1; i<=stepsU; i++) {
            let u = window.ALTURA_ENCAIXE - (distU * (i / stepsU));
            atualizarCenaSimulacaoFrame(cmdsFrame, simZ, u, simRotBase, simR); await esperar(16);
        }
        
        // 7. VOLTA AO CENTRO
        for(let i=1; i<=15; i++) {
             atualizarCenaSimulacaoFrame(cmdsFrame, simZ, window.ALTURA_REPOUSO, simRotBase - (simRotBase * (i/15)), simR - (simR * (i/15))); await esperar(16);
        }
        simR = 0; simRotBase = 0;
    }
}

// ==========================================
// OUTRAS FUNÇÕES E EXPORTAÇÃO
// ==========================================
async function simularQueda(memoriaAteAgora) {
    let speedEl = document.getElementById('input-velocidade');
    let multi = speedEl ? parseFloat(speedEl.value) : 2; 
    let framesCorte = Math.max(5, Math.floor(40 / multi)); 

    let pedaco = gerarArame(memoriaAteAgora, false); 
    let totalZ = 0; for(let c of memoriaAteAgora) totalZ += (c.z || 0);
    pedaco.rotation.x = (totalZ * Math.PI) / 180; pedaco.position.x = -DISTANCIA_CORTE; 
    
    if (arameSimulacao) cena.remove(arameSimulacao);
    arameSimulacao = gerarArame([], true); arameSimulacao.rotation.x = (totalZ * Math.PI) / 180;
    cena.add(arameSimulacao); cena.add(pedaco); 

    for(let f=0; f<10; f++) { grupoCorte.position.z -= 1 * multi; await esperar(10); }
    let velY = 0;
    for(let f=0; f<framesCorte; f++) {
        velY -= (0.6 * multi); pedaco.position.y += velY; pedaco.rotation.z += (0.02 * multi); pedaco.rotation.x += (0.01 * multi); 
        if(f < 10) grupoCorte.position.z += 1 * multi; await esperar(16);
    }
    cena.remove(pedaco); grupoCorte.position.z = 0; 
}

window.ExecutarAdicionar = function() {
    if (simulandoVideo) return; let cmd = lerInputsSeguro();
    if(cmd.x===0 && cmd.z===0 && cmd.d===0) return;
    limparCaixasHTML(); memoriaCNC.push(cmd); desenharListaSegura(); atualizarCenaCAD(); atualizarEstatisticas();
};
window.ExecutarCorte = function() {
    if (simulandoVideo) return; memoriaCNC.push({ tipo: 'corte' });
    desenharListaSegura(); atualizarCenaCAD(); atualizarEstatisticas();
};
window.ExecutarLimpar = function() {
    if (simulandoVideo) return; memoriaCNC = []; 
    desenharListaSegura(); atualizarCenaCAD(); atualizarEstatisticas();
};
window.ExecutarPlay = async function() {
    if (memoriaCNC.length === 0 || simulandoVideo) return; 
    simulandoVideo = true; isPaused = false;
    let btnPause = document.getElementById('btn-pause');
    if (btnPause) { btnPause.style.display = 'block'; btnPause.innerHTML = "⏸ PAUSA"; btnPause.style.background = "#607d8b"; }
    
    if (arameVisivel) { cena.remove(arameVisivel); arameVisivel = null; }
    await new Promise(r => setTimeout(r, 300)); 

    simZ = 0; simR = 0; simRotBase = 0; let memoriaTemporaria = [];

    for (let cmd of memoriaCNC) {
        if (cmd.tipo === 'movimento') {
            await simularPassoCNC(cmd, memoriaTemporaria); memoriaTemporaria.push(cmd); 
        } else if (cmd.tipo === 'corte') {
            await simularQueda(memoriaTemporaria); memoriaTemporaria = []; simZ = 0; simR = 0; simRotBase = 0;
        }
    }
    if (arameSimulacao) { cena.remove(arameSimulacao); arameSimulacao = null; }
    simulandoVideo = false; if (btnPause) btnPause.style.display = 'none'; atualizarCenaCAD(); 
};

window.ExecutarExportarNC = function() {
    if (memoriaCNC.length === 0) { alert("O programa está vazio."); return; }
    let inputNome = document.getElementById('input-nome-ficheiro');
    let nomeFicheiro = (inputNome && inputNome.value.trim() !== '') ? inputNome.value.trim() : 'projeto_arame';
    if (!nomeFicheiro.endsWith('.nc')) nomeFicheiro += '.nc';
    let textoCNC = ""; let expZ = 0, expR = 0, expRotBase = 0, expU = window.ALTURA_REPOUSO; 
    const fmt = (val) => Number(val.toFixed(2));

    memoriaCNC.forEach((cmd) => {
        if (cmd.tipo === 'corte') {
            textoCNC += `(CORTE)\n`; expZ = 0; expR = 0; expRotBase = 0; expU = window.ALTURA_REPOUSO; 
            textoCNC += `(0,0,0,0,${expU},100,150,180,80,60)\n`; return;
        }
        let vx = cmd.vx || 100, vy = cmd.vy || 150, vz = cmd.vz || 180, vu = cmd.vu || 60, vr = cmd.vr || 80;
        if (cmd.x !== 0) textoCNC += `(${fmt(cmd.x)},${fmt(expRotBase)},${fmt(expZ)},${fmt(expR)},${fmt(expU)},${fmt(vx)},${fmt(vy)},${fmt(vz)},${fmt(vr)},${fmt(vu)})\n`;
        if (cmd.z !== 0) { expZ += cmd.z; textoCNC += `(0,${fmt(expRotBase)},${fmt(expZ)},${fmt(expR)},${fmt(expU)},${fmt(vx)},${fmt(vy)},${fmt(vz)},${fmt(vr)},${fmt(vu)})\n`; }
        if (cmd.d !== 0) {
            let dir = Math.sign(cmd.d); 
            let targetR = (dir > 0) ? window.AFINACAO_R_DIR : window.AFINACAO_R_ESQ; 
            let startRotBase = (dir > 0) ? 90 : -90;
            
            if (expR !== targetR || expRotBase !== startRotBase) {
                expR = targetR; expRotBase = startRotBase;
                textoCNC += `(0,${fmt(expRotBase)},${fmt(expZ)},${fmt(expR)},${fmt(expU)},${fmt(vx)},${fmt(vy)},${fmt(vz)},${fmt(vr)},${fmt(vu)})\n`;
            }
            expU = window.ALTURA_ENCAIXE; textoCNC += `(0,${fmt(expRotBase)},${fmt(expZ)},${fmt(expR)},${fmt(expU)},${fmt(vx)},${fmt(vy)},${fmt(vz)},${fmt(vr)},${fmt(vu)})\n`;
            
            let anguloMaquina = dir * (90 - Math.abs(cmd.d) * window.VARREDURA_PRETO); 
            
            textoCNC += `(0,${fmt(anguloMaquina)},${fmt(expZ)},${fmt(expR)},${fmt(expU)},${fmt(vx)},${fmt(vy)},${fmt(vz)},${fmt(vr)},${fmt(vu)})\n`;
            textoCNC += `(0,${fmt(expRotBase)},${fmt(expZ)},${fmt(expR)},${fmt(expU)},${fmt(vx)},${fmt(vy)},${fmt(vz)},${fmt(vr)},${fmt(vu)})\n`;
            expU = window.ALTURA_REPOUSO; textoCNC += `(0,${fmt(expRotBase)},${fmt(expZ)},${fmt(expR)},${fmt(expU)},${fmt(vx)},${fmt(vy)},${fmt(vz)},${fmt(vr)},${fmt(vu)})\n`;
            expR = 0; expRotBase = 0; textoCNC += `(0,${fmt(expRotBase)},${fmt(expZ)},${fmt(expR)},${fmt(expU)},${fmt(vx)},${fmt(vy)},${fmt(vz)},${fmt(vr)},${fmt(vu)})\n`;
        }
    });

    let blob = new Blob([textoCNC], { type: 'text/plain' }); let url = URL.createObjectURL(blob);
    let a = document.createElement('a'); a.href = url; a.download = nomeFicheiro;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
};

window.ExecutarGuardarProjeto = function() {
    if (memoriaCNC.length === 0) return; let inputNome = document.getElementById('input-nome-ficheiro');
    let nome = (inputNome && inputNome.value.trim() !== '') ? inputNome.value.trim() : 'projeto';
    let blob = new Blob([`(JSON_START)\n${JSON.stringify(memoriaCNC)}\n(JSON_END)`], { type: 'application/json' });
    let a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome + ".json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

window.ExecutarImportarProjeto = function(event) {
    let file = event.target.files[0]; if (!file) return; let reader = new FileReader();
    reader.onload = function(e) {
        let conteudo = e.target.result; let iInicio = conteudo.indexOf("(JSON_START)"), iFim = conteudo.indexOf("(JSON_END)");
        if (iInicio !== -1 && iFim !== -1) {
            try {
                memoriaCNC = JSON.parse(conteudo.substring(iInicio + 12, iFim).trim());
                let inNome = document.getElementById('input-nome-ficheiro');
                if (inNome) inNome.value = file.name.replace(/\.[^/.]+$/, "");
                desenharListaSegura(); atualizarCenaCAD(); atualizarEstatisticas();
            } catch (err) { alert("Erro ao ler o ficheiro."); }
        } else { alert("Ficheiro inválido."); }
        event.target.value = '';
    };
    reader.readAsText(file);
};

function desenharListaSegura() {
    const listaHtml = document.getElementById('lista-comandos');
    if (!listaHtml) return; listaHtml.innerHTML = '';
    memoriaCNC.forEach((c, i) => {
        let txt = c.tipo === 'corte' ? "✂️ CORTAR ARAME" : `X:${c.x} Z:${c.z}º D:${c.d}º <span style="font-size:10px; color:#8b949e;">[V: ${c.vx||100}, ${c.vy||150}, ${c.vz||180}, ${c.vu||60}, ${c.vr||80}]</span>`;
        listaHtml.innerHTML += `<div class="linha-comando"><span>N${i+1} ${txt}</span> <span class="remover" onclick="removerLinha(${i})">✖</span></div>`;
    });
    listaHtml.scrollTop = listaHtml.scrollHeight;
}

window.removerLinha = function(index) {
    if (simulandoVideo) return; memoriaCNC.splice(index, 1); 
    desenharListaSegura(); atualizarCenaCAD(); atualizarEstatisticas(); 
};

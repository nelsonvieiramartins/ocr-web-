// js/ui.js
import { getElement, escapeHTML } from './utils.js';

// Referências aos Elementos (exemplo, adicione todos que precisar)
const spinner = getElement('spinner');
const statusText = getElement('statusText');
const progressBar = getElement('progressBar');
const loginForm = getElement('loginForm');
const authStatus = getElement('authStatus');
const mainContent = getElement('mainContent');
const rawOutputPre = getElement('rawOutput');
const spellCheckOutputDiv = getElement('spellCheckOutput');
const spellCheckButton = getElement('spellCheckButton');
const saveButton = getElement('saveButton');
const webcamSection = getElement('webcamSection');
const webcamVideo = getElement('webcamVideo');
const activateWebcamButton = getElement('activateWebcamButton');
const takePhotoButton = getElement('takePhotoButton');
const stopWebcamButton = getElement('stopWebcamButton');
const webcamError = getElement('webcamError');
const savedEntriesList = getElement('savedEntriesList');
const downloadJsonButton = getElement('downloadJsonButton');
const searchResultsDiv = getElement('searchResults');
const extractedFieldsList = getElement('extractedFieldsList');
// Adicione referências para outros elementos conforme necessário (inputs, botões, etc.)

let currentWebcamStream = null;

/** Atualiza a mensagem de status e a visibilidade do spinner/progresso. */
export function setStatus(text, showProgress = false, progressValue = null) {
    if (statusText) statusText.textContent = text;
    if (spinner) spinner.style.display = (showProgress === 'spinner') ? 'inline-block' : 'none';
    if (progressBar) {
        progressBar.style.display = (showProgress && showProgress !== 'spinner') ? 'block' : 'none';
        if (progressValue !== null) {
            progressBar.value = progressValue;
            progressBar.removeAttribute('max'); // Para modo indeterminado se necessário
        } else {
            progressBar.value = 0; // Reset se nenhum valor específico
             progressBar.setAttribute('max', '1');
        }
    }
}

/** Controla a visibilidade da UI baseada no estado de autenticação. */
export function updateAuthUI(user) {
    if (user) {
        if (loginForm) loginForm.style.display = 'none';
        if (authStatus) authStatus.innerHTML = `Bem-vindo, ${escapeHTML(user.displayName || user.email)}! <button id="logoutButton" class="danger">Sair</button>`;
        if (mainContent) mainContent.style.display = 'block';
         setStatus('Pronto para processar.');
    } else {
        if (loginForm) loginForm.style.display = 'block';
        if (authStatus) authStatus.textContent = 'Faça login para acessar a aplicação.';
        if (mainContent) mainContent.style.display = 'none';
         setStatus('Faça login para começar.');
         if (savedEntriesList) savedEntriesList.innerHTML = '';
         if (downloadJsonButton) downloadJsonButton.disabled = true;
         resetOCRUI(); // Limpa a UI do OCR ao deslogar
    }
}

/** Limpa os resultados do OCR e campos relacionados na UI. */
export function resetOCRUI() {
    if (rawOutputPre) rawOutputPre.textContent = '(Nenhum resultado ainda)';
    if (spellCheckOutputDiv) spellCheckOutputDiv.innerHTML = '(Aguardando verificação...)';
    if (spellCheckButton) spellCheckButton.disabled = true;
    if (saveButton) saveButton.disabled = true;
    if (extractedFieldsList) {
       extractedFieldsList.querySelectorAll('span[id^="ext_"]').forEach(span => {
           span.textContent = 'Não encontrado';
           span.className = 'not-found';
       });
    }
    const uploadInput = getElement('uploadInput');
    if (uploadInput) uploadInput.value = '';
    const mobileCameraInput = getElement('mobileCameraInput');
    if (mobileCameraInput) mobileCameraInput.value = '';
    if (webcamError) webcamError.textContent = '';
    // Parar webcam se estiver ativa
    if (currentWebcamStream) {
        stopWebcam();
    }
}

/** Exibe os resultados brutos do OCR. */
export function displayOCRResults(text) {
    rawOcrText = text || ''; // Armazena o texto bruto globalmente ou em um estado
    if (rawOutputPre) rawOutputPre.textContent = rawOcrText || '(Nenhum texto encontrado)';
    if (spellCheckButton) spellCheckButton.disabled = !rawOcrText;
    // Habilita o botão salvar apenas se houver texto E usuário logado (verificar auth no main.js)
    // if (saveButton) saveButton.disabled = !rawOcrText; // Lógica de habilitação mais complexa no main.js
}

/** Exibe os resultados da verificação ortográfica. */
export function displaySpellCheckResults(htmlContent, statusMsg) {
    if (spellCheckOutputDiv) spellCheckOutputDiv.innerHTML = htmlContent;
    if (statusMsg) setStatus(statusMsg);
    if (spellCheckButton) spellCheckButton.disabled = false; // Reabilita após verificação
}

/** Atualiza o texto bruto com os erros destacados. */
export function highlightSpellErrorsInRawText(highlightedHtml) {
     if (rawOutputPre) rawOutputPre.innerHTML = highlightedHtml;
}

/** Exibe os campos extraídos (experimental). */
export function displayExtractedFields(data) {
    for (const key in data) {
        const span = getElement(`ext_${key}`);
        if (span) {
            if (data[key]) {
                span.textContent = data[key];
                span.className = 'extracted-value';
            } else {
                span.textContent = 'Não encontrado';
                span.className = 'not-found';
            }
        }
    }
}

/** Configura e inicia a webcam. */
export async function setupWebcam() {
    resetOCRUI();
    if (webcamError) webcamError.textContent = '';
    setStatus('Acessando webcam...', 'spinner');
    if (currentWebcamStream) {
        currentWebcamStream.getTracks().forEach(track => track.stop());
    }
    const constraints = { video: { facingMode: 'environment' } }; // Tenta câmera traseira primeiro
    try {
        currentWebcamStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (webcamVideo) {
            webcamVideo.srcObject = currentWebcamStream;
            webcamVideo.style.display = 'block'; // Garante visibilidade
        }
        if (webcamSection) webcamSection.style.display = 'block';
        if (takePhotoButton) takePhotoButton.style.display = 'inline-block';
        if (stopWebcamButton) stopWebcamButton.style.display = 'inline-block';
        if (activateWebcamButton) activateWebcamButton.style.display = 'none';
        setStatus('Webcam ativa. Posicione e tire a foto.');
    } catch (err) {
        console.error("Erro ao acessar webcam:", err);
        setStatus('Erro ao acessar webcam.');
        if (webcamError) webcamError.textContent = `Erro: ${err.name} - ${err.message}. Verifique permissões e HTTPS.`;
        currentWebcamStream = null;
        if (webcamSection) webcamSection.style.display = 'none'; // Esconde a seção se falhar
    }
}

/** Para a stream da webcam e atualiza a UI. */
export function stopWebcam() {
    if (currentWebcamStream) {
        currentWebcamStream.getTracks().forEach(track => track.stop());
        currentWebcamStream = null;
    }
    if (webcamVideo) {
        webcamVideo.srcObject = null;
        webcamVideo.style.display = 'none'; // Esconder vídeo
    }
     if (webcamSection) webcamSection.style.display = 'none'; // Esconder seção
    if (takePhotoButton) takePhotoButton.style.display = 'none';
    if (stopWebcamButton) stopWebcamButton.style.display = 'none';
    if (activateWebcamButton) activateWebcamButton.style.display = 'inline-block';
    setStatus('Webcam parada.');
}

/** Captura um frame da webcam. */
export function captureWebcamFrame(callback) {
    if (!currentWebcamStream || !webcamVideo) {
        setStatus('Erro: Webcam não está ativa.');
        return;
    }
    setStatus('Capturando imagem...', 'spinner');
    const canvas = getElement('webcamCanvas');
    const video = getElement('webcamVideo');
    if (!canvas || !video) return;

    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(function(blob) {
        if (blob) {
            callback(blob); // Envia o blob para processamento
            stopWebcam();   // Para a webcam após a captura
        } else {
            setStatus('Erro ao criar imagem da webcam.');
        }
    }, 'image/jpeg');
}


/** Exibe as entradas salvas na lista. */
export function displaySavedEntries(entries) {
    if (!savedEntriesList) return;
    savedEntriesList.innerHTML = ''; // Limpa antes de adicionar
    if (!entries || entries.length === 0) {
        savedEntriesList.innerHTML = '<li>Nenhuma entrada salva encontrada.</li>';
        if (downloadJsonButton) downloadJsonButton.disabled = true;
        return;
    }

    entries.forEach((entry, index) => {
        const li = document.createElement('li');
        const date = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Data desconhecida';
        li.innerHTML = `
            <b>Entrada ${index + 1} (${date}):</b><br>
            Nome: ${escapeHTML(entry.extracted?.nome) || '<i class="not-found">Não encontrado</i>'}<br>
            CPF: ${escapeHTML(entry.extracted?.cpf) || '<i class="not-found">Não encontrado</i>'}<br>
            Data Nasc: ${escapeHTML(entry.extracted?.data_nascimento) || '<i class="not-found">Não encontrado</i>'}<br>
            Telefone: ${escapeHTML(entry.extracted?.telefone) || '<i class="not-found">Não encontrado</i>'}<br>
            Texto Bruto: <pre style="display: inline; font-size: 0.9em; color: #555;">${escapeHTML(entry.rawText?.substring(0, 50))}${entry.rawText?.length > 50 ? '...' : ''}</pre>
        `;
        savedEntriesList.appendChild(li);
    });
    if (downloadJsonButton) downloadJsonButton.disabled = false;
}

/** Exibe uma mensagem de erro na seção de entradas salvas. */
export function displaySavedEntriesError(message) {
     if (!savedEntriesList) return;
     savedEntriesList.innerHTML = `<li class="error-message">${escapeHTML(message)}</li>`;
     if (downloadJsonButton) downloadJsonButton.disabled = true;
}

/** Exibe os resultados da busca. */
export function displaySearchResults(results) {
    if (!searchResultsDiv) return;
    searchResultsDiv.innerHTML = ''; // Limpa resultados anteriores
    if (!results || results.length === 0) {
        searchResultsDiv.innerHTML = 'Nenhum cadastro encontrado.';
        return;
    }
    const ul = document.createElement('ul');
    results.forEach((entry, index) => {
        const li = document.createElement('li');
         const date = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Data desconhecida';
        // Similar ao displaySavedEntries, adapte conforme necessário
         li.innerHTML = `
            <b>Resultado ${index + 1} (${date}):</b><br>
            Nome: ${escapeHTML(entry.extracted?.nome) || '<i class="not-found">Não encontrado</i>'}<br>
            CPF: ${escapeHTML(entry.extracted?.cpf) || '<i class="not-found">Não encontrado</i>'}<br>
            Data Nasc: ${escapeHTML(entry.extracted?.data_nascimento) || '<i class="not-found">Não encontrado</i>'}<br>
            Telefone: ${escapeHTML(entry.extracted?.telefone) || '<i class="not-found">Não encontrado</i>'}
        `;
        ul.appendChild(li);
    });
    searchResultsDiv.appendChild(ul);
}

// Variável global temporária para o texto bruto do OCR
// Idealmente, isso seria gerenciado por um módulo de estado, mas para simplicidade:
export let rawOcrText = '';
export function updateRawOcrText(text) {
    rawOcrText = text;
}
// js/ocr.js
import { resizeImage } from './utils.js';
import {
    setStatus,
    displayOCRResults,
    displaySpellCheckResults,
    highlightSpellErrorsInRawText,
    displayExtractedFields,
    updateRawOcrText // Função para atualizar o texto bruto na UI
} from './ui.js';
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js"; // Import getAuth

// --- Tesseract Processing ---

/** Processa a imagem com Tesseract.js */
export function processImageWithTesseract(imageDataBlob) {
    setStatus('Preparando imagem...', 'spinner');
    // Redimensiona antes de enviar ao Tesseract para otimizar
    resizeImage(imageDataBlob, 1200, (resizedBlob) => { // Largura máxima 1200px
        setStatus('Iniciando OCR...', true, 0); // Mostra barra de progresso
        let currentStatus = 'Iniciando OCR...'; // Guardar o último status válido

        Tesseract.recognize(
            resizedBlob,
            'por', // Idioma Português
            {
                 langPath: '/tessdata', // Define explicitamente o caminho
                 logger: m => {
                    // console.log(m); // Log detalhado
                    let statusTextLog = `Processando: ${m.status}...`;
                    let progress = null;
                    if (m.progress && m.status === 'recognizing text') {
                        progress = m.progress;
                        statusTextLog = `Reconhecendo texto (${(progress * 100).toFixed(0)}%)`;
                    }
                     currentStatus = statusTextLog; // Atualiza o status atual
                     setStatus(currentStatus, true, progress); // Atualiza status e progresso
                }
            }
        ).then(({ data: { text } }) => {
            currentStatus = 'OCR Concluído!';
            setStatus(currentStatus);
            updateRawOcrText(text); // Atualiza o texto na UI/estado
            displayOCRResults(text); // Exibe o texto bruto
            // Extrai campos automaticamente após OCR
            const extracted = extractFieldsFromText(text);
            displayExtractedFields(extracted);
            // Habilita botão de salvar (verificação final no main.js)
            const saveButton = document.getElementById('saveButton');
             if(saveButton) {
                 const user = getAuth().currentUser;
                 saveButton.disabled = !text || !user;
             }
        }).catch(err => {
            currentStatus = 'Erro durante o OCR.';
            setStatus(currentStatus);
            console.error('Erro no Tesseract.js:', err);
             updateRawOcrText(''); // Limpa texto em caso de erro
            displayOCRResults(`Erro no OCR: ${err.message || err}`);
            displayExtractedFields({}); // Limpa campos extraídos
        }).finally(() => {
            // Garante que a barra de progresso seja escondida
            // Mantém o status final (Concluído ou Erro)
            setStatus(currentStatus);
             const progressBar = document.getElementById('progressBar');
             if (progressBar) progressBar.style.display = 'none';
              // Reabilitar botões desabilitados durante o OCR (ex: webcam)
             const activateWebcamButton = document.getElementById('activateWebcamButton');
             if(activateWebcamButton) activateWebcamButton.disabled = false;
             // Indica que o processamento terminou (para o main.js)
             window.dispatchEvent(new CustomEvent('processingComplete'));
        });
    });
}


// --- Spell Checking (LanguageTool) ---

/** Verifica ortografia usando LanguageTool API. */
export async function checkSpellingWithLanguageTool(textToCheck) {
    if (!textToCheck || textToCheck.trim() === '(Nenhum resultado ainda)' || textToCheck.trim() === '') {
        displaySpellCheckResults('Nenhum texto para verificar.', '');
        return;
    }

    if (!navigator.onLine) {
        displaySpellCheckResults('<p class="error-message">Sem conexão com a internet para verificar ortografia.</p>', '');
        return;
    }

    const spellCheckButton = document.getElementById('spellCheckButton');
    if (spellCheckButton) spellCheckButton.disabled = true;
    setStatus('Verificando ortografia...', 'spinner');
    displaySpellCheckResults('<i>Contactando API LanguageTool...</i>', '');

    const apiUrl = 'https://languagetool.org/api/v2/check';
    const data = new URLSearchParams();
    data.append('text', textToCheck);
    data.append('language', 'pt-BR');
    data.append('enabledOnly', 'false'); // Verificar todas as regras

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: data
        });

        if (!response.ok) {
            throw new Error(`Erro na API LanguageTool: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();
        console.log("LanguageTool Result:", result);

        if (result.matches && result.matches.length > 0) {
            const highlightedHtml = highlightErrors(textToCheck, result.matches);
            highlightSpellErrorsInRawText(highlightedHtml); // Atualiza o <pre> com spans

            let suggestionsHtml = '<ul>';
            result.matches.forEach(match => {
                const context = match.context.text.substring(0, match.context.offset)
                              + '<span class="error-word-in-context">'
                              + match.context.text.substring(match.context.offset, match.context.offset + match.context.length)
                              + '</span>'
                              + match.context.text.substring(match.context.offset + match.context.length);
                suggestionsHtml += `<li><b>${match.message}</b><br><i>Contexto:</i> <span class="error-context">"${context}"</span><br>`;
                if (match.replacements && match.replacements.length > 0) {
                    suggestionsHtml += `<i>Sugestões:</i> <span class="suggestions">${match.replacements.map(r => r.value).join(', ')}</span>`;
                }
                suggestionsHtml += `</li>`;
            });
            suggestionsHtml += '</ul>';
            displaySpellCheckResults(suggestionsHtml, 'Verificação concluída. Erros destacados.');

        } else {
             highlightSpellErrorsInRawText(textToCheck); // Remove highlights se não houver erros
            displaySpellCheckResults('<p style="color: green;">Nenhum erro ortográfico encontrado.</p>', 'Verificação concluída.');
        }

    } catch (error) {
        console.error('Erro ao verificar ortografia:', error);
        displaySpellCheckResults(`<p class="error-message">Erro na verificação: ${error.message}</p>`, 'Erro na verificação.');
         highlightSpellErrorsInRawText(textToCheck); // Garante que o texto original sem highlights seja mostrado
    } finally {
         if (spellCheckButton) spellCheckButton.disabled = false; // Reabilita o botão
         setStatus('Pronto.'); // Limpa status de verificação
    }
}

/** Helper function to create highlighted HTML from text and matches. */
function highlightErrors(originalText, matches) {
    let highlightedText = originalText;
    // Itera de trás para frente para não bagunçar os offsets
    for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        const offset = match.offset;
        const length = match.length;
        const before = highlightedText.substring(0, offset);
        const erro = highlightedText.substring(offset, offset + length);
        const after = highlightedText.substring(offset + length);

        let suggestions = match.replacements.map(r => r.value).join(', ');
        let title = suggestions ? `Sugestões: ${suggestions}` : 'Erro ortográfico/gramatical';
        // Escapar HTML dentro do erro para segurança
        const escapedErro = erro.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

        const highlightedError = `<span class="spell-error" title="${title}">${escapedErro}</span>`;
        highlightedText = before + highlightedError + after;
    }
    return highlightedText;
}


// --- Experimental Field Extraction ---

/** Tenta extrair campos específicos usando Regex (MUITO experimental). */
export function extractFieldsFromText(text) {
    const dados = { nome: null, cpf: null, data_nascimento: null, telefone: null };
    if (!text) return dados;

    const textLower = text.toLowerCase();

    try {
        // Nome: Procura por "nome:", "nome completo:", ou linhas que parecem nomes (ex: 2+ palavras capitalizadas)
        let nomeMatch = text.match(/Nome Completo:\s*([^\n]+)/i)
                     || text.match(/Nome:\s*([^\n]+)/i);
                     //|| text.match(/^([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)+)/m); // Linha começando com nome capitalizado

        if (nomeMatch && nomeMatch[1]) {
             // Limpa espaços extras e garante capitalização
             dados.nome = nomeMatch[1].trim().replace(/\s+/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        } else {
             // Heurística alternativa: primeira linha com múltiplas palavras capitalizadas?
             const lines = text.split('\n');
             for(const line of lines) {
                 const potentialName = line.match(/^[A-ZÀ-Ú][a-zà-ú']+(?:\s+(?:da|de|do|e|dos|das)\s+)?(?:[A-ZÀ-Ú][a-zà-ú']+)(?:\s+(?:da|de|do|e|dos|das)\s+)?(?:[A-ZÀ-Ú][a-zà-ú']+)?(?:\s+(?:da|de|do|e|dos|das)\s+)?(?:[A-ZÀ-Ú][a-zà-ú']+)?/); // Tenta capturar nomes com 'de', 'da', 'do', etc.
                 if (potentialName && potentialName[0].split(' ').length >= 2) {
                     dados.nome = potentialName[0].trim().replace(/\s+/g, ' ');
                     break; // Pega o primeiro encontrado
                 }
             }
        }

        // CPF: Formato XXX.XXX.XXX-XX
        const cpfMatch = text.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
        if (cpfMatch && cpfMatch[1]) dados.cpf = cpfMatch[1];

        // Data Nascimento: Formato DD/MM/YYYY ou DD-MM-YYYY
         const dataMatch = text.match(/(\d{2}[/-]\d{2}[/-]\d{4})/);
         // Tenta encontrar algo como "Nascimento:" antes da data
         const dataNascMatch = text.match(/(?:Nascimento|Data de Nascimento|Nasc\.?):\s*(\d{2}[/-]\d{2}[/-]\d{4})/i);
        if (dataNascMatch && dataNascMatch[1]) {
             dados.data_nascimento = dataNascMatch[1].replace('-', '/');
        } else if (dataMatch && dataMatch[1]) {
            // Verifica se a data encontrada é razoável (ex: ano > 1900)
            const year = parseInt(dataMatch[1].substring(6), 10);
            if (year > 1900 && year <= new Date().getFullYear()) {
                 dados.data_nascimento = dataMatch[1].replace('-', '/'); // Padroniza para /
            }
        }

        // Telefone: Formatos (XX) XXXX-XXXX, (XX) XXXXX-XXXX, XX XXXXXXXX, etc.
         const telMatch = text.match(/(\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4})/);
        if (telMatch && telMatch[1]) {
            let cleanTel = telMatch[1].replace(/[().\s-]/g, ''); // Remove formatação
             // Reformatar opcionalmente: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
             if (cleanTel.length === 11) {
                 dados.telefone = `(${cleanTel.substring(0,2)}) ${cleanTel.substring(2,7)}-${cleanTel.substring(7)}`;
             } else if (cleanTel.length === 10) {
                  dados.telefone = `(${cleanTel.substring(0,2)}) ${cleanTel.substring(2,6)}-${cleanTel.substring(6)}`;
             } else {
                 dados.telefone = cleanTel; // Mantem como está se não for 10 ou 11 dígitos
             }
        }

    } catch (e) {
        console.error("Erro na extração experimental de campos:", e);
    }
    console.log("Campos extraídos:", dados);
    return dados;
}
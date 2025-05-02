// js/firestore.js
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { db } from './auth.js'; // Pega a instância DB inicializada em auth.js
import {
    setStatus,
    displaySavedEntries,
    displaySavedEntriesError,
    displaySearchResults,
    getElement,
    rawOcrText // Pega o texto OCR da UI
} from './ui.js';


let currentUnsubscribe = null; // Guardar a função de unsubscribe do listener

/** Salva uma nova entrada no Firestore. */
export async function saveEntry() {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!db || !user) {
        setStatus('Faça login para salvar dados.');
        return;
    }

    // Pega os dados extraídos da UI
    const extractedData = {};
    const fields = ['nome', 'cpf', 'data_nascimento', 'telefone'];
    fields.forEach(key => {
        const span = getElement(`ext_${key}`);
        if (span && span.textContent !== 'Não encontrado' && span.className === 'extracted-value') {
            extractedData[key] = span.textContent;
        } else {
             extractedData[key] = null;
        }
    });


    const entry = {
        timestamp: new Date().toISOString(),
        rawText: rawOcrText, // Usa o texto OCR armazenado em ui.js
        extracted: extractedData,
        userId: user.uid
    };

    setStatus('Salvando no banco de dados...', 'spinner');
    try {
        const docRef = await addDoc(collection(db, 'entries'), entry);
        console.log("Documento salvo com ID: ", docRef.id);
        setStatus('Dados salvos com sucesso!');
        // Limpar a UI do OCR após salvar? Decidir no main.js
    } catch (error) {
        console.error('Erro ao salvar no Firestore:', error);
        setStatus(`Erro ao salvar: ${error.message}`);
    }
}

/** Ouve em tempo real as entradas salvas do usuário logado. */
export function listenToSavedEntries() {
    const auth = getAuth();
    const user = auth.currentUser;

    if (currentUnsubscribe) {
        console.log("Parando listener Firestore anterior.");
        currentUnsubscribe(); // Para qualquer listener anterior
        currentUnsubscribe = null;
    }

    if (!db || !user) {
        displaySavedEntriesError("Usuário não autenticado.");
        return null; // Retorna null pois não pode iniciar
    }

    console.log("Iniciando listener Firestore para userId:", user.uid);
    const q = query(
        collection(db, 'entries'),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc')
    );

    currentUnsubscribe = onSnapshot(q, (snapshot) => {
        console.log("Recebido snapshot do Firestore:", snapshot.docs.length, "documentos.");
        const entries = [];
        snapshot.forEach(doc => {
            entries.push({ id: doc.id, ...doc.data() });
        });
        displaySavedEntries(entries); // Atualiza a UI com os dados
    }, (error) => {
        // Tratamento de erro modificado para esconder erro de índice
        console.error('Erro original ao buscar entradas:', error);

        if (error.code === 'failed-precondition' && error.message.includes('index')) {
            console.warn('Consulta Firestore falhou devido a índice ausente (userId ASC, timestamp DESC?). A lista de entradas salvas não será exibida. Crie o índice no Console do Firebase.');
            displaySavedEntriesError("Não foi possível carregar as entradas salvas."); // Mensagem genérica
        } else {
            displaySavedEntriesError(`Erro ao carregar entradas: ${error.message}`); // Outros erros
        }
    });

    // Retorna a função para parar de ouvir (será chamada no logout)
    return currentUnsubscribe;
}

// Função para explicitamente parar o listener (usada em auth.js no logout)
export function stopListeningToSavedEntries() {
     if (currentUnsubscribe) {
        console.log("Parando listener Firestore explicitamente.");
        currentUnsubscribe();
        currentUnsubscribe = null;
    }
}


/** Busca entradas por Nome ou CPF (busca no cliente após carregar tudo). */
export async function searchEntriesByNameOrCPF(searchTerm) {
    const auth = getAuth();
    const user = auth.currentUser;
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();

    if (!db || !user) {
        displaySearchResults([]); // Limpa resultados
        setStatus('Faça login para buscar.');
        return;
    }
    if (!lowerCaseSearchTerm) {
        displaySearchResults([]); // Limpa resultados se busca vazia
        setStatus('Digite um termo para buscar.');
        return;
    }

    setStatus('Buscando cadastros...', 'spinner');
    try {
        // Busca todos os documentos do usuário de uma vez
        // CUIDADO: Isso pode ser ineficiente/caro para muitos documentos.
        // Uma busca real no backend seria melhor para escalar.
        const q = query(collection(db, 'entries'), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);

        const results = [];
        snapshot.forEach(doc => {
            const entry = doc.data();
            const name = entry.extracted?.nome?.toLowerCase();
            const cpf = entry.extracted?.cpf; // CPF não precisa de lowercase

            if ((name && name.includes(lowerCaseSearchTerm)) || (cpf && cpf.includes(lowerCaseSearchTerm))) {
                results.push({ id: doc.id, ...entry });
            }
        });

        // Ordena os resultados localmente por timestamp (mais recentes primeiro)
        results.sort((a, b) => (b.timestamp || 0).localeCompare(a.timestamp || 0));

        displaySearchResults(results);
        setStatus(`Busca concluída. ${results.length} resultado(s) encontrado(s).`);

    } catch (error) {
        console.error('Erro ao buscar cadastros:', error);
        displaySearchResults([]); // Limpa resultados em caso de erro
        setStatus(`Erro na busca: ${error.message}`);
    }
}


/** Baixa todas as entradas do usuário como um arquivo JSON. */
export async function downloadEntriesAsJSON() {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!db || !user) {
        setStatus('Faça login para baixar dados.');
        return;
    }

    setStatus('Preparando download...', 'spinner');
    try {
        const q = query(collection(db, 'entries'), where('userId', '==', user.uid), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        const entries = [];
        snapshot.forEach(doc => {
            // Remove userId do objeto a ser baixado, se preferir
            const data = doc.data();
            // delete data.userId; // Opcional
            entries.push({ id: doc.id, ...data });
        });

        if (entries.length === 0) {
            setStatus('Nenhuma entrada para baixar.');
            return;
        }

        const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ocr_entries_${user.uid.substring(0, 6)}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setStatus('Download iniciado.');

    } catch (error) {
        console.error('Erro ao baixar JSON:', error);
        setStatus(`Erro ao baixar JSON: ${error.message}`);
    }
}
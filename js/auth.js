// js/auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { firebaseConfig } from './firebaseConfig.js';
import { setStatus, updateAuthUI, getElement } from './ui.js';
import { listenToSavedEntries, stopListeningToSavedEntries } from './firestore.js'; // Importar listener

let auth;
let db;
let unsubscribeFirestore = null; // Para parar de ouvir o Firestore no logout

/** Inicializa Firebase Auth e Firestore. */
export function initializeAuth() {
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log('Firebase inicializado com sucesso! Project ID:', firebaseConfig.projectId);
        return { auth, db }; // Retorna as instâncias inicializadas
    } catch (error) {
        console.error('Erro ao inicializar Firebase:', error);
        setStatus(`Erro crítico ao conectar com Firebase: ${error.message}`);
        updateAuthUI(null); // Garante que a UI mostre o estado deslogado/erro
        return { auth: null, db: null };
    }
}

/** Ouve mudanças no estado de autenticação. */
export function listenAuthState(authInstance) {
     if (!authInstance) {
        console.error("Auth não inicializado para listenAuthState.");
        updateAuthUI(null);
        return;
    }
    onAuthStateChanged(authInstance, user => {
        updateAuthUI(user);
        if (user) {
            // Usuário logado: começa a ouvir as entradas salvas
            if (unsubscribeFirestore) {
                unsubscribeFirestore(); // Para listener anterior se houver
            }
            unsubscribeFirestore = listenToSavedEntries(); // Inicia novo listener
        } else {
            // Usuário deslogado: para de ouvir as entradas salvas
             if (unsubscribeFirestore) {
                unsubscribeFirestore();
                unsubscribeFirestore = null;
            }
            // Limpar UI de entradas salvas (já feito em updateAuthUI)
        }
         // Habilitar/desabilitar botão Salvar baseado no login
        const saveButton = getElement('saveButton');
        if (saveButton) {
           // A habilitação real depende também de ter texto OCR (ver main.js)
           saveButton.disabled = !user;
        }
    });
}

/** Faz login com E-mail e Senha. */
export async function handleLogin() {
    const emailInput = getElement('emailInput');
    const passwordInput = getElement('passwordInput');
    const email = emailInput?.value.trim();
    const password = passwordInput?.value.trim();

    if (!email || !password) {
        setStatus('Preencha e-mail e senha.');
        return;
    }
    if (!auth) {
         setStatus('Erro: Autenticação não inicializada.');
         return;
    }

    setStatus('Fazendo login...', 'spinner');
    try {
        await signInWithEmailAndPassword(auth, email, password);
        setStatus('Login realizado com sucesso!');
        if(emailInput) emailInput.value = ''; // Limpa campos
        if(passwordInput) passwordInput.value = '';
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        setStatus(`Erro ao fazer login: ${error.message}`);
    }
}

/** Faz login com Google. */
export async function handleGoogleSignIn() {
     if (!auth) {
         setStatus('Erro: Autenticação não inicializada.');
         return;
     }
    const provider = new GoogleAuthProvider();
    setStatus('Fazendo login com Google...', 'spinner');
    try {
        await signInWithPopup(auth, provider);
        setStatus('Login com Google realizado com sucesso!');
    } catch (error) {
        console.error('Erro ao fazer login com Google:', error);
        // Códigos comuns: 'auth/popup-closed-by-user', 'auth/cancelled-popup-request'
        if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
             setStatus(`Erro no login com Google: ${error.message}`);
        } else {
             setStatus('Login com Google cancelado.');
        }
    }
}

/** Registra um novo usuário com E-mail e Senha. */
export async function handleRegister() {
    const emailInput = getElement('emailInput');
    const passwordInput = getElement('passwordInput');
    const email = emailInput?.value.trim();
    const password = passwordInput?.value.trim();

    if (!email || !password) {
        setStatus('Preencha e-mail e senha para registrar.');
        return;
    }
     if (!auth) {
         setStatus('Erro: Autenticação não inicializada.');
         return;
     }

    setStatus('Registrando usuário...', 'spinner');
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        setStatus('Registro realizado com sucesso! Faça login.');
         if(emailInput) emailInput.value = ''; // Limpa campos
         if(passwordInput) passwordInput.value = '';
    } catch (error) {
        console.error('Erro ao registrar:', error);
        setStatus(`Erro ao registrar: ${error.message}`);
    }
}

/** Faz logout do usuário atual. */
export async function handleLogout() {
     if (!auth) {
         setStatus('Erro: Autenticação não inicializada.');
         return;
     }
    setStatus('Saindo...', 'spinner');
    try {
        await signOut(auth);
        setStatus('Você saiu.');
        // A UI será atualizada pelo onAuthStateChanged
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        setStatus(`Erro ao sair: ${error.message}`);
    }
}

// Exporta a instância do auth para ser usada em outros módulos se necessário
// Cuidado ao expor diretamente, mas pode ser útil
export { auth, db };
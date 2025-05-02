// js/utils.js

/**
 * Redimensiona uma imagem Blob para uma largura máxima.
 * @param {Blob} blob O Blob da imagem original.
 * @param {number} maxWidth A largura máxima desejada.
 * @param {function(Blob)} callback Função a ser chamada com o Blob redimensionado.
 */
export function resizeImage(blob, maxWidth, callback) {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
            const scale = maxWidth / width;
            width = maxWidth;
            height = height * scale;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error("Não foi possível obter o contexto 2D do canvas.");
            callback(blob); // Retorna o blob original em caso de erro
            return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((resizedBlob) => {
            if (resizedBlob) {
                callback(resizedBlob);
            } else {
                console.error("Falha ao criar Blob redimensionado.");
                callback(blob); // Retorna o blob original
            }
        }, 'image/jpeg', 0.85); // Qualidade 0.85
    };
    img.onerror = () => {
        console.error("Erro ao carregar imagem para redimensionamento.");
        callback(blob); // Retorna o blob original
    };
    img.src = URL.createObjectURL(blob);
}

/**
 * Retorna uma referência segura para um elemento do DOM.
 * @param {string} id O ID do elemento.
 * @returns {HTMLElement | null} O elemento ou null se não encontrado.
 */
export function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Elemento com ID "${id}" não encontrado.`);
    }
    return element;
}

/**
 * Escapa caracteres HTML para exibição segura.
 * @param {string} str A string a ser escapada.
 * @returns {string} A string escapada.
 */
export function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (match) {
        switch (match) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;'; // Ou &apos;
            default: return match;
        }
    });
}
// === upload.js ===

// Elementos
const form = document.getElementById('uploadForm');
const fileInput = document.getElementById('htmlFile');
const label = form.querySelector('.file-input-label');

// Mostrar nombre del archivo en el label
fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        label.textContent = `📄 ${fileInput.files[0].name}`;
    } else {
        label.textContent = "Arrastra tu archivo HTML aquí o haz clic para seleccionarlo";
    }
});

// Validar HTML al enviar el formulario
form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!fileInput.files.length) {
        alert('Por favor, selecciona un archivo HTML.');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        const htmlContent = e.target.result;
        const errors = validateHTML(htmlContent);
        sessionStorage.setItem('htmlValidationErrors', JSON.stringify(errors));
        window.location.href = 'errores.html';
    };

    reader.readAsText(file);
});

// Función de validación HTML
function validateHTML(html) {
    const lines = html.split(/\r?\n/);
    let errors = [];
    const stack = [];
    const selfClosingTags = new Set([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img',
        'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]);

    const doctypeRegex = /^!DOCTYPE\s/i;
    let insideComment = false;
    const incompleteOpenings = new Set();

    function checkAttributeQuotes(tagText, lineNumber) {
        const quotes = tagText.match(/["']/g);
        if (quotes && quotes.length % 2 !== 0) {
            errors.push(`Línea ${lineNumber}: Atributos con comillas sin cerrar en la etiqueta: <${tagText}>`);
        }
    }

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let pos = 0;

        while (pos < line.length) {
            const ltIndex = line.indexOf('<', pos);
            if (ltIndex === -1) break;

            const gtIndex = line.indexOf('>', ltIndex + 1);
            if (gtIndex === -1) {
                const incompleteTag = line.slice(ltIndex).trim();
                errors.push(`Línea ${i + 1}: Etiqueta incompleta, falta '>' después de '<' en: ${incompleteTag}`);

                let tagNameMatch = incompleteTag.match(/^<\s*\/?\s*([a-z0-9]+)/i);
                if (tagNameMatch) {
                    const tagName = tagNameMatch[1].toLowerCase();
                    incompleteOpenings.add(tagName);
                }

                break;
            }

            const tagContentRaw = line.slice(ltIndex + 1, gtIndex).trim();

            if (insideComment) {
                if (tagContentRaw.endsWith('--')) insideComment = false;
                pos = gtIndex + 1;
                continue;
            }

            if (tagContentRaw.startsWith('!--')) {
                if (!tagContentRaw.endsWith('--')) insideComment = true;
                pos = gtIndex + 1;
                continue;
            }

            if (doctypeRegex.test(tagContentRaw)) {
                pos = gtIndex + 1;
                continue;
            }

            checkAttributeQuotes(tagContentRaw, i + 1);

            const isClosing = tagContentRaw.startsWith('/');
            let tagName = isClosing
                ? tagContentRaw.slice(1).split(/\s+/)[0].toLowerCase()
                : tagContentRaw.split(/\s+/)[0].toLowerCase();

            if (!tagName.match(/^[a-z0-9]+$/)) {
                errors.push(`Línea ${i + 1}: Nombre de etiqueta inválido o mal formado en: <${tagContentRaw}>`);
                pos = gtIndex + 1;
                continue;
            }

            const selfClosed = tagContentRaw.endsWith('/');

            if (isClosing) {
                if (stack.length === 0) {
                    if (!incompleteOpenings.has(tagName)) {
                        errors.push(`Línea ${i + 1}: Etiqueta de cierre </${tagName}> sin etiqueta de apertura.`);
                    }
                } else {
                    let foundIndex = -1;
                    for (let j = stack.length - 1; j >= 0; j--) {
                        if (stack[j].tag === tagName) {
                            foundIndex = j;
                            break;
                        }
                    }
                    if (foundIndex === -1) {
                        if (!incompleteOpenings.has(tagName)) {
                            errors.push(`Línea ${i + 1}: Etiqueta de cierre </${tagName}> sin etiqueta de apertura correspondiente.`);
                        }
                    } else {
                        for (let k = stack.length - 1; k > foundIndex; k--) {
                            const unclosed = stack.pop();
                            errors.push(`Línea ${unclosed.line}: Etiqueta <${unclosed.tag}> sin cerrar.`);
                        }
                        stack.pop();
                    }
                }
            } else if (!selfClosed && !selfClosingTags.has(tagName)) {
                if (stack.length === 0 || stack[stack.length - 1].tag !== tagName) {
                    stack.push({ tag: tagName, line: i + 1 });
                }
            }

            pos = gtIndex + 1;
        }
    }

    stack.forEach(unclosed => {
        errors.push(`Línea ${unclosed.line}: Etiqueta <${unclosed.tag}> sin cerrar.`);
    });

    return [...new Set(errors)];
}

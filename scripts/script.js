document.getElementById('uploadForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const input = document.getElementById('htmlFile');
    if (!input.files.length) {
        alert('Por favor, selecciona un archivo HTML.');
        return;
    }
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const htmlContent = e.target.result;
        const errors = validateHTML(htmlContent);
        sessionStorage.setItem('htmlValidationErrors', JSON.stringify(errors));
        window.location.href = 'errores.html';
    };
    reader.readAsText(file);
});

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

    // Para guardar etiquetas incompletas detectadas, para no reportar cierre sin apertura
    const incompleteOpenings = new Set();

    function checkAttributeQuotes(tagText, lineNumber) {
        const quotes = tagText.match(/["']/g);
        if (quotes && (quotes.length % 2 !== 0)) {
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

            // Detectamos etiqueta incompleta: falta >
            if (gtIndex === -1) {
                const incompleteTag = line.slice(ltIndex).trim();
                errors.push(`Línea ${i + 1}: Etiqueta incompleta, falta '>' después de '<' en: ${incompleteTag}`);

                // Extraemos nombre para marcar como incompleta y evitar falso positivo en cierre
                let tagNameMatch = incompleteTag.match(/^<\s*\/?\s*([a-z0-9]+)/i);
                if (tagNameMatch) {
                    const tagName = tagNameMatch[1].toLowerCase();
                    incompleteOpenings.add(tagName);
                }

                break;
            }

            const tagContentRaw = line.slice(ltIndex + 1, gtIndex).trim();

            if (insideComment) {
                if (tagContentRaw.endsWith('--')) {
                    insideComment = false;
                }
                pos = gtIndex + 1;
                continue;
            }
            if (tagContentRaw.startsWith('!--')) {
                if (!tagContentRaw.endsWith('--')) {
                    insideComment = true;
                }
                pos = gtIndex + 1;
                continue;
            }

            if (doctypeRegex.test(tagContentRaw)) {
                pos = gtIndex + 1;
                continue;
            }

            checkAttributeQuotes(tagContentRaw, i + 1);

            const isClosing = tagContentRaw.startsWith('/');
            let tagName = '';
            if (isClosing) {
                tagName = tagContentRaw.slice(1).split(/\s+/)[0].toLowerCase();
            } else {
                tagName = tagContentRaw.split(/\s+/)[0].toLowerCase();
            }

            if (!tagName.match(/^[a-z0-9]+$/)) {
                errors.push(`Línea ${i + 1}: Nombre de etiqueta inválido o mal formado en: <${tagContentRaw}>`);
                pos = gtIndex + 1;
                continue;
            }

            const selfClosed = tagContentRaw.endsWith('/');

            if (isClosing) {
                if (stack.length === 0) {
                    // Solo reportamos cierre sin apertura si la apertura no está en incompletas
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

    errors = [...new Set(errors)];
    return errors;
}

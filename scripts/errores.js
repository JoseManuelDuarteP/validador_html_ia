window.addEventListener('DOMContentLoaded', () => {
    const resultContainer = document.getElementById('resultContainer');

    const errorsJSON = sessionStorage.getItem('htmlValidationErrors');
    if (!errorsJSON) {
        resultContainer.textContent = 'No se encontraron resultados de validación. Por favor vuelve a validar un archivo.';
        return;
    }

    const errors = JSON.parse(errorsJSON);

    if (errors.length === 0) {
        resultContainer.style.color = 'green';
        resultContainer.textContent = 'No se encontraron errores. ¡Tu archivo HTML es válido!';
    } else {
        resultContainer.style.color = 'red';
        const ul = document.createElement('ul');
        errors.forEach(err => {
            const li = document.createElement('li');
            li.textContent = err;
            ul.appendChild(li);
        });
        resultContainer.appendChild(ul);
    }

    // Limpiar almacenamiento para no mostrar resultados viejos luego
    sessionStorage.removeItem('htmlValidationErrors');
});

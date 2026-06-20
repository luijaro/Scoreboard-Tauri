// =========================
//      UTILS GENERALES
// =========================

/**
 * Convierte un string a formato slug (minúsculas, sin espacios, solo letras/números/guiones)
 * @param {string} str
 * @returns {string}
 */
function toSlug(str) {
    return (str || '')
        .toString()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
}

/**
 * Capitaliza la primera letra de un string
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Devuelve la ruta de imagen de personaje según juego y nombre
 * @param {string} personaje
 * @param {string} juego
 * @returns {string}
 */
function getCharImg(personaje, juego) {
    if (!personaje || !juego) return "";
    return `personajes/${juego.toLowerCase()}/${personaje.toLowerCase()}.png`;
}

/**
 * Devuelve el twitter formateado (si no tiene @ lo agrega)
 * @param {string} twitter
 * @param {string} nombre
 * @returns {string}
 */
function getTwitter(twitter, nombre) {
    if (twitter && twitter.trim()) return twitter.startsWith('@') ? twitter : '@' + twitter;
    return '@' + (nombre || '').replace(/\s/g, '_');
}

/**
 * Devuelve la bandera desde flagcdn según código de país (2 letras)
 * @param {string} country
 * @returns {string}
 */
function getFlag(country) {
    if (!country) return "";
    return `https://flagcdn.com/${country.toLowerCase()}.svg`;
}

/**
 * Formatea fecha a DD/MM/YYYY
 * @param {string|Date} fecha
 * @returns {string}
 */
function formatFecha(fecha) {
    const d = new Date(fecha);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('es-CL');
}

/**
 * Limpia un objeto de propiedades vacías o nulas
 * @param {object} obj
 * @returns {object}
 */
function cleanObject(obj) {
    const out = {};
    Object.keys(obj).forEach(k => {
        if (obj[k] !== null && obj[k] !== undefined && obj[k] !== '') out[k] = obj[k];
    });
    return out;
}

/**
 * Agrupa un array de objetos por una propiedad
 * @param {Array} arr
 * @param {string} prop
 * @returns {Object}
 */
function groupBy(arr, prop) {
    return arr.reduce((acc, item) => {
        const key = item[prop] || 'undefined';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});
}

if (typeof module !== 'undefined') {
    module.exports = { toSlug, capitalize, getCharImg, getTwitter, getFlag, formatFecha, cleanObject, groupBy };
}
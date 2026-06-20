const { toSlug, capitalize, getCharImg, getTwitter, getFlag, formatFecha, cleanObject, groupBy } = require('./utils');

// ── toSlug ────────────────────────────────────────────────────────────────────
describe('toSlug', () => {
    test('convierte a minúsculas y reemplaza espacios con guiones', () => {
        expect(toSlug('Guilty Gear Strive')).toBe('guilty-gear-strive');
    });
    test('elimina acentos', () => {
        expect(toSlug('Güilán García')).toBe('guilan-garcia');
    });
    test('elimina guiones duplicados al inicio y final', () => {
        expect(toSlug('  hola mundo  ')).toBe('hola-mundo');
    });
    test('maneja string vacío', () => {
        expect(toSlug('')).toBe('');
    });
    test('maneja null/undefined sin lanzar error', () => {
        expect(toSlug(null)).toBe('');
        expect(toSlug(undefined)).toBe('');
    });
    test('elimina caracteres especiales', () => {
        expect(toSlug('Under Night In-Birth')).toBe('under-night-in-birth');
    });
});

// ── capitalize ────────────────────────────────────────────────────────────────
describe('capitalize', () => {
    test('capitaliza la primera letra', () => {
        expect(capitalize('snow')).toBe('Snow');
    });
    test('no modifica el resto del string', () => {
        expect(capitalize('sNOW')).toBe('SNOW');
    });
    test('maneja string vacío', () => {
        expect(capitalize('')).toBe('');
    });
    test('maneja null/undefined', () => {
        expect(capitalize(null)).toBe('');
        expect(capitalize(undefined)).toBe('');
    });
});

// ── getCharImg ────────────────────────────────────────────────────────────────
describe('getCharImg', () => {
    test('devuelve la ruta correcta', () => {
        expect(getCharImg('Akiha', 'MBAACC')).toBe('personajes/mbaacc/akiha.png');
    });
    test('normaliza a minúsculas', () => {
        expect(getCharImg('AKATSUKI', 'UNI2')).toBe('personajes/uni2/akatsuki.png');
    });
    test('devuelve string vacío si falta personaje', () => {
        expect(getCharImg('', 'GGST')).toBe('');
    });
    test('devuelve string vacío si falta juego', () => {
        expect(getCharImg('Sol', '')).toBe('');
    });
    test('devuelve string vacío si ambos son null', () => {
        expect(getCharImg(null, null)).toBe('');
    });
});

// ── getTwitter ────────────────────────────────────────────────────────────────
describe('getTwitter', () => {
    test('retorna twitter con @ si ya lo tiene', () => {
        expect(getTwitter('@snow', 'Snow')).toBe('@snow');
    });
    test('agrega @ si no lo tiene', () => {
        expect(getTwitter('snow', 'Snow')).toBe('@snow');
    });
    test('usa nombre como fallback si twitter está vacío', () => {
        expect(getTwitter('', 'Snow Player')).toBe('@Snow_Player');
    });
    test('usa nombre como fallback si twitter es null', () => {
        expect(getTwitter(null, 'Vermillion')).toBe('@Vermillion');
    });
    test('maneja nombre con espacios reemplazándolos por _', () => {
        expect(getTwitter('', 'WG Snow')).toBe('@WG_Snow');
    });
});

// ── getFlag ───────────────────────────────────────────────────────────────────
describe('getFlag', () => {
    test('devuelve URL de flagcdn en minúsculas', () => {
        expect(getFlag('CL')).toBe('https://flagcdn.com/cl.svg');
    });
    test('normaliza a minúsculas', () => {
        expect(getFlag('AR')).toBe('https://flagcdn.com/ar.svg');
    });
    test('devuelve string vacío si country es falsy', () => {
        expect(getFlag('')).toBe('');
        expect(getFlag(null)).toBe('');
        expect(getFlag(undefined)).toBe('');
    });
});

// ── formatFecha ───────────────────────────────────────────────────────────────
describe('formatFecha', () => {
    test('devuelve string no vacío para fecha válida', () => {
        const result = formatFecha('2026-04-20');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });
    test('devuelve string vacío para fecha inválida', () => {
        expect(formatFecha('not-a-date')).toBe('');
        expect(formatFecha('')).toBe('');
    });
});

// ── cleanObject ───────────────────────────────────────────────────────────────
describe('cleanObject', () => {
    test('elimina propiedades vacías, null y undefined', () => {
        const input = { a: 'valor', b: '', c: null, d: undefined, e: 0, f: false };
        expect(cleanObject(input)).toEqual({ a: 'valor', e: 0, f: false });
    });
    test('retorna objeto vacío si todo es vacío', () => {
        expect(cleanObject({ a: '', b: null })).toEqual({});
    });
    test('no muta el objeto original', () => {
        const input = { a: 'x', b: '' };
        cleanObject(input);
        expect(input).toEqual({ a: 'x', b: '' });
    });
});

// ── groupBy ───────────────────────────────────────────────────────────────────
describe('groupBy', () => {
    const players = [
        { nombre: 'Snow',       equipo: 'WG' },
        { nombre: 'Vermillion', equipo: 'Aracne' },
        { nombre: 'eÑE',        equipo: 'WG' },
    ];

    test('agrupa correctamente por propiedad', () => {
        const result = groupBy(players, 'equipo');
        expect(result['WG'].length).toBe(2);
        expect(result['Aracne'].length).toBe(1);
    });
    test('agrupa bajo "undefined" si la propiedad no existe', () => {
        const result = groupBy(players, 'pais');
        expect(result['undefined'].length).toBe(3);
    });
    test('retorna objeto vacío para array vacío', () => {
        expect(groupBy([], 'equipo')).toEqual({});
    });
});

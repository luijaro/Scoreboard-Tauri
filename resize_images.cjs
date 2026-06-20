const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Ruta de la carpeta de personajes (Ajustar si es necesario)
const targetDir = path.resolve(__dirname, 'personajes');

// Función recursiva para buscar archivos
function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const images = [];
walkDir(targetDir, (filePath) => {
    // Buscar PNGs y JPGs
    if (filePath.match(/\.(png|jpg|jpeg)$/i)) {
        images.push(filePath);
    }
});

console.log(`Encontradas ${images.length} imágenes. Comenzando a comprimir a 250x170...`);

async function processImages() {
    let count = 0;
    for (let img of images) {
        try {
            // fit: 'inside' mantiene la proporción original y asegura que el máximo sea 250x170
            // Puedes cambiarlo a 'cover' si quieres que recorte el excedente o 'fill' para estirarlo.
            const buffer = await sharp(img)
                .resize({ width: 250, height: 170, fit: 'inside' })
                .toBuffer();
            
            // Sobrescribimos la imagen original con la versión reducida
            fs.writeFileSync(img, buffer);
            count++;
            if (count % 50 === 0) {
                console.log(`Progreso: ${count} / ${images.length} imágenes procesadas...`);
            }
        } catch (err) {
            console.error(`❌ Error en: ${img}`, err.message);
        }
    }
    console.log(`✅ ¡Proceso terminado! Se redimensionaron ${count} imágenes.`);
}

processImages();

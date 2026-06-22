const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse release argument (default to patch version increment)
const bumpType = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('Uso: npm run release -- [patch|minor|major]');
  process.exit(1);
}

// 1. Read package.json version
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;
const [major, minor, patch] = currentVersion.split('.').map(Number);

let newVersion = '';
if (bumpType === 'patch') newVersion = `${major}.${minor}.${patch + 1}`;
else if (bumpType === 'minor') newVersion = `${major}.${minor + 1}.0`;
else if (bumpType === 'major') newVersion = `${major + 1}.0.0`;

console.log(`Incrementando versión de ${currentVersion} a ${newVersion}...`);

// 2. Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

// 3. Update Cargo.toml
const cargoTomlPath = path.join(__dirname, '../src-tauri/Cargo.toml');
let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
cargoToml = cargoToml.replace(/^version = ".*"$/m, `version = "${newVersion}"`);
fs.writeFileSync(cargoTomlPath, cargoToml, 'utf8');

// 4. Update tauri.conf.json
const tauriConfPath = path.join(__dirname, '../src-tauri/tauri.conf.json');
let tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
tauriConf.version = newVersion;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');

console.log('✅ Archivos de versión actualizados.');

// 5. Build the app
console.log('🔨 Compilando aplicación de Tauri (esto puede tardar unos minutos)...');
try {
  execSync('npm run tauri build', { stdio: 'inherit' });
} catch (e) {
  console.error('❌ Error durante la compilación de Tauri. Proceso abortado.');
  process.exit(1);
}

// 6. Commit changes and push
console.log('💾 Confirmando cambios y creando tag en Git...');
try {
  execSync('git add .', { stdio: 'inherit' });
  execSync(`git commit -m "Release v${newVersion}"`, { stdio: 'inherit' });
  execSync(`git tag v${newVersion}`, { stdio: 'inherit' });
  execSync('git push origin main --tags', { stdio: 'inherit' });
} catch (e) {
  console.warn('⚠️ Advertencia: No se pudo realizar el push automático a Git. Verifica tu conexión.');
}

// 7. Publish to GitHub Releases
console.log('🚀 Generando updater metadata (latest.json)...');
const nsisPath = `src-tauri/target/release/bundle/nsis/Streamcontrol MS_${newVersion}_x64-setup.exe`;
const msiPath = `src-tauri/target/release/bundle/msi/Streamcontrol MS_${newVersion}_x64_en-US.msi`;
const sigPath = `src-tauri/target/release/bundle/nsis/Streamcontrol MS_${newVersion}_x64-setup.exe.sig`;
const latestJsonPath = `src-tauri/target/release/bundle/nsis/latest.json`;

let updaterJsonCreated = false;
try {
  if (fs.existsSync(sigPath)) {
    const signature = fs.readFileSync(sigPath, 'utf8').trim();
    const latestJson = {
      version: newVersion,
      notes: `Release v${newVersion}`,
      pub_date: new Date().toISOString(),
      platforms: {
        "windows-x86_64": {
          signature: signature,
          url: `https://github.com/luijaro/Scoreboard-Tauri/releases/download/v${newVersion}/Streamcontrol%20MS_${newVersion}_x64-setup.exe`
        }
      }
    };
    fs.writeFileSync(latestJsonPath, JSON.stringify(latestJson, null, 2), 'utf8');
    console.log('✅ latest.json generado correctamente.');
    updaterJsonCreated = true;
  } else {
    console.warn('⚠️ Advertencia: No se encontró el archivo de firma (.sig). Asegúrate de que TAURI_SIGNING_PRIVATE_KEY esté configurada.');
  }
} catch (e) {
  console.error('❌ Error al generar latest.json:', e);
}

console.log('🚀 Subiendo binarios de release a GitHub...');
try {
  const assetsToUpload = [nsisPath, msiPath];
  if (updaterJsonCreated) {
    assetsToUpload.push(latestJsonPath);
  }
  const assetsString = assetsToUpload.map(p => `"${p}"`).join(' ');
  execSync(`gh release create v${newVersion} ${assetsString} --title "v${newVersion}" --notes "Release v${newVersion}"`, { stdio: 'inherit' });
  console.log(`🎉 ¡Éxito! La versión v${newVersion} ha sido compilada, subida a GitHub Releases y confirmada en Git.`);
} catch (e) {
  console.error('❌ Error al subir la release a GitHub. Verifica que tengas el CLI de gh instalado y autenticado.');
}


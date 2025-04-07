const bcrypt = require('bcrypt');

async function testHash() {
  // Define el PIN que quieres probar
  const pin = "123456";

  // Genera un hash para el PIN con 10 salt rounds
  const generatedHash = await bcrypt.hash(pin, 10);
  console.log("Nuevo hash generado:", generatedHash);

  // Compara el PIN original con el hash generado
  const isValid = await bcrypt.compare(pin, generatedHash);
  console.log("¿El PIN es válido según bcrypt.compare? ", isValid);
}

testHash().catch((err) => {
  console.error("Error en la generación o comparación del hash:", err);
});

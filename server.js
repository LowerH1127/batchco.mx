const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'batchco2026';
const DATA_FILE = path.join(__dirname, 'public', 'catalogo.json');

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint protegido para guardar el catálogo
app.post('/api/guardar-catalogo', (req, res) => {
  const providedPassword = req.headers['x-admin-password'];

  if (!providedPassword || providedPassword !== ADMIN_PASSWORD) {
    console.log('Intento de guardado con contraseña inválida');
    return res.status(403).json({ error: 'Acceso denegado. Credenciales inválidas.' });
  }

  const catalogo = req.body;
  if (!Array.isArray(catalogo) || !catalogo.length) {
    return res.status(400).json({ error: 'Formato de datos inválido.' });
  }

  fs.writeFile(DATA_FILE, JSON.stringify(catalogo), 'utf8', (err) => {
    if (err) {
      console.error('Error de escritura:', err);
      return res.status(500).json({ error: 'Fallo al persistir los datos en el servidor.' });
    }
    console.log(`Catálogo guardado: ${catalogo.length} productos`);
    res.json({ success: true, count: catalogo.length });
  });
});

// Endpoint público para obtener el catálogo guardado
app.get('/api/catalogo', (req, res) => {
  if (fs.existsSync(DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    res.json(data);
  } else {
    res.json([]);
  }
});

app.listen(PORT, () => {
  console.log(`Batch Co. Server online — puerto ${PORT}`);
});

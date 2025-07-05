const express = require('express'); // untuk create server
const path = require('path'); // untuk mengetahui lokasi html, css
const bodyParser = require('body-parser'); // untuk send & receive data
const axios = require('axios');

require('dotenv').config(); //file env
console.log(process.env.DB_HOST, process.env.DB_USER, process.env.DB_PASSWORD, process.env.DB_NAME);

const knex = require('knex')({
    client: 'mysql',
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    }
});

const app = express();

let initialPath = path.join(__dirname, "public");

app.use(bodyParser.json());
app.use(express.static(initialPath));

app.get('/', (req, res) => {
    res.sendFile(path.join(initialPath, "dashboard.html"))
})

app.get('/', (req, res) => {
    res.sendFile(path.join(initialPath, "login.html"))
})

app.get('/login', (req, res) => {
    res.sendFile(path.join(initialPath, "login.html"));
})

app.get('/register', (req, res) => {
    res.sendFile(path.join(initialPath, "register.html"))
})

app.get('/region', (req, res) => {
    res.sendFile(path.join(initialPath, "region.html"))
})

app.get('/add-street', (req, res) => {
    res.sendFile(path.join(initialPath, "add-street.html"))
})

app.get('/marker', (req, res) => {
    res.sendFile(path.join(initialPath, 'marker.html'));
});

app.get('/polyline', (req, res) => {
    res.sendFile(path.join(initialPath, 'polyline.html'));
});

app.get('/polygon', (req, res) => {
    res.sendFile(path.join(initialPath, 'polygon.html'));
});

app.get('/manage-street', (req, res) => {
    res.sendFile(path.join(initialPath, 'manage-street.html'));
});

app.post('/register-user', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Semua field wajib diisi' });
    }

    try {
        console.log('Mengirim data registrasi ke API eksternal:', { name, email, password });
        const response = await axios.post('https://gisapis.manpits.xyz/api/register', {
            name,
            email,
            password
        });
        console.log('Respons dari API eksternal:', response.data);
        const meta = response.data.meta;
        if (meta.code === 200 && meta.data) {
            return res.json(meta.data);
        } else {
            return res.status(400).json({ message: meta.message || 'Registrasi gagal' });
        }
    } catch (error) {
        console.error('Gagal registrasi:', error.response?.data || error.message);
        const msg = error.response?.data?.meta?.message || 'Registrasi gagal';
        return res.status(500).json({ message: msg });
    }
});

app.post('/login-user', async (req, res) => {
    const { email, password } = req.body;
    try {
        const response = await axios.post('https://gisapis.manpits.xyz/api/login', {
            email,
            password
        });
        const meta = response.data.meta;
        if (meta.code === 200 && meta.token) {
            const tokenParts = meta.token.split('.');
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
            return res.json({
                token: meta.token,
                email: email,
                message: meta.message,
                userId: payload.sub
            });
        } else {
            return res.status(401).json('Email atau password salah.');
        }
    } catch (error) {
        console.error('Gagal login:', error.response?.data || error.message);
        return res.status(500).json('Login gagal. Periksa kembali email/password atau koneksi.');
    }
});

app.post('/tambah-marker', (req, res) => {
    console.log('Body yang diterima:', req.body);
    const { latitude, longitude, name, description, user_id } = req.body;
    console.log('Data diterima:', latitude, longitude, name, description);

    if (latitude && longitude) {
        knex('marker').insert({
            latitude: latitude,
            longitude: longitude,
            name: name || null,
            description: description || null,
            user_id: user_id
        })
        .returning('id')
        .then(result => {
            res.json({ message: 'Marker berhasil disimpan', id: result[0] });
        })
        .catch(error => {
            console.error(error);
            res.status(500).json({ message: 'Terjadi kesalahan saat menyimpan marker' });
        });
    } else {
        res.status(400).json({ message: 'Koordinat tidak valid' });
    }
});

app.get('/marker-user/:id', (req, res) => {
    const userId = req.params.id;
    knex('marker')
    .where(function() {
        this.where({ user_id: userId }).orWhereNull('user_id')
    })
    .then(rows => res.json(rows))
    .catch(err => {
        console.error('Error saat ambil marker:', err);
        res.status(500).json({ message: 'Gagal mengambil marker' })
    });
});

app.put('/update-marker', (req, res) => {
    const { id, name, description } = req.body;
    knex('marker').where({ id }).update({ name, description })
        .then(() => res.json({ message: 'Marker diperbarui' }))
        .catch(err => {
        console.error('Gagal update marker:', err);
        res.status(500).json({ message: 'Gagal update marker' });
        });
});

app.delete('/delete-marker/:id', (req, res) => {
    const { id } = req.params;
    knex('marker').where({ id }).del()
        .then(() => res.json({ message: 'Marker dihapus' }))
        .catch(err => {
        console.error('Gagal hapus marker:', err);
        res.status(500).json({ message: 'Gagal hapus marker' });
        });
});

app.post('/tambah-polyline', (req, res) => {
    const { coordinates, name, description, user_id } = req.body;
    console.log('Data polyline diterima:', coordinates);

    if (!coordinates) {
        return res.status(400).json({ message: 'Koordinat diperlukan' });
    }

    knex('polyline').insert({
        coordinates: JSON.stringify(coordinates),
        name: name || null,
        description: description || null,
        user_id: user_id || null
    })
    .then(() => {
        res.json({ message: 'Polyline berhasil disimpan' });
    })
    .catch(error => {
        console.error('Gagal simpan polyline:', error);
        res.status(500).json({ message: 'Terjadi kesalahan saat menyimpan polyline' });
    });
});

app.get('/polyline-user/:id', (req, res) => {
    const userId = req.params.id;
    knex('polyline')
        .where(function() {
            this.where({ user_id: userId }).orWhereNull('user_id')
        })
        .then(rows => res.json(rows))
        .catch(err => {
            console.error('Gagal ambil polyline:', err);
            res.status(500).json({ message: 'Gagal mengambil polyline' });
        });
});

app.put('/update-polyline', (req, res) => {
    const { id, name, description } = req.body;
    knex('polyline')
        .where({ id })
        .update({ name, description })
        .then(() => res.json({ message: 'Polyline berhasil diperbarui' }))
        .catch(err => {
            console.error('Gagal update polyline:', err);
            res.status(500).json({ message: 'Gagal update polyline' });
        });
});

app.delete('/delete-polyline/:id', (req, res) => {
    const { id } = req.params;
    knex('polyline')
        .where({ id })
        .del()
        .then(() => res.json({ message: 'Polyline berhasil dihapus' }))
        .catch(err => {
            console.error('Gagal hapus polyline:', err);
            res.status(500).json({ message: 'Gagal hapus polyline' });
        });
});

app.post('/tambah-polygon', (req, res) => {
    const { coordinates, name, description, user_id } = req.body;
    console.log('Data polygon diterima:', coordinates);

    if (!coordinates) {
        return res.status(400).json({ message: 'Koordinat diperlukan' });
    }

    knex('polygon').insert({
        coordinates: JSON.stringify(coordinates),
        name: name || null,
        description: description || null,
        user_id: user_id || null
    })
    .then(() => {
        res.json({ message: 'Polygon berhasil disimpan' });
    })
    .catch(error => {
        console.error('Gagal simpan polygon:', error);
        res.status(500).json({ message: 'Terjadi kesalahan saat menyimpan polygon' });
    });
});

app.get('/polygon-user/:id', (req, res) => {
    const userId = req.params.id;
    knex('polygon')
        .where(function() {
            this.where({ user_id: userId }).orWhereNull('user_id')
        })
        .then(rows => res.json(rows))
        .catch(err => {
            console.error('Gagal ambil polygon:', err);
            res.status(500).json({ message: 'Gagal mengambil polygon' });
        });
});

app.put('/update-polygon', (req, res) => {
    const { id, name, description } = req.body;
    knex('polygon')
        .where({ id })
        .update({ name, description })
        .then(() => res.json({ message: 'Polygon berhasil diperbarui' }))
        .catch(err => {
            console.error('Gagal update polygon:', err);
            res.status(500).json({ message: 'Gagal update polygon' });
        });
});

app.delete('/delete-polygon/:id', (req, res) => {
    const { id } = req.params;
    knex('polygon')
        .where({ id })
        .del()
        .then(() => res.json({ message: 'Polygon berhasil dihapus' }))
        .catch(err => {
            console.error('Gagal hapus polygon:', err);
            res.status(500).json({ message: 'Gagal hapus polygon' });
        });
});

app.get('/api/mregion', async (req, res) => {
    try {
        const token = req.headers.authorization;
        console.log('Meneruskan token ke API eksternal:', token);
        const response = await axios.get('https://gisapis.manpits.xyz/api/mregion', {
            headers: {
                Authorization: token
            }
        });
        res.json(response.data);
    } catch (err) {
        console.error('Gagal proxy mregion:', err.response?.status, err.response?.data || err.message);
        res.status(500).json({
            message: 'Gagal mengambil data mregion',
            error: err.response?.data || err.message,
            status: err.response?.status
        });
    }
});

app.post('/api/ruasjalan', async (req, res) => {
    try {
        const response = await axios.post('https://gisapis.manpits.xyz/api/ruasjalan', req.body, {
        headers: {
            Authorization: `Bearer ${req.headers.authorization}`,
            'Content-Type': 'application/json'
        }
        });
        res.json(response.data);
    } catch (err) {
        console.error('Error API ruasjalan:', err.response?.data || err.message);
        res.status(500).json({ message: 'Gagal menyimpan ruas jalan', err: err.response?.data || err.message });
    }
});

app.get('/ruasjalan-user', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const response = await axios.get('https://gisapis.manpits.xyz/api/ruasjalan', {
      headers: {
        Authorization: token
      }
    });
    res.json(response.data);
  } catch (err) {
    console.error('Gagal ambil ruas jalan:', err.response?.data || err.message);
    res.status(500).json({ message: 'Gagal ambil ruas jalan', error: err.message });
  }
});


app.get('/api/meksisting', async (req, res) => {
    try {
        const token = req.headers.authorization;
        console.log('Meneruskan token ke API eksternal:', token);
        const response = await axios.get('https://gisapis.manpits.xyz/api/meksisting', {
            headers: {
                Authorization: token
            }
        });
        res.json(response.data);
    } catch (err) {
        console.error('Gagal proxy meksisting:', err.response?.status, err.response?.data || err.message);

        res.status(500).json({
            message: 'Gagal mengambil data meksisting',
            error: err.response?.data || err.message,
            status: err.response?.status
        });
    }
});

app.get('/api/mjenisjalan', async (req, res) => {
    try {
        const token = req.headers.authorization;
        console.log('Meneruskan token ke API eksternal:', token);

        const response = await axios.get('https://gisapis.manpits.xyz/api/mjenisjalan', {
            headers: {
                Authorization: token
            }
        });
        res.json(response.data);
    } catch (err) {
        console.error('Gagal proxy mjenisjalan:', err.response?.status, err.response?.data || err.message);

        res.status(500).json({
            message: 'Gagal mengambil data mjenisjalan',
            error: err.response?.data || err.message,
            status: err.response?.status
        });
    }
});

app.get('/api/mkondisi', async (req, res) => {
    try {
        const token = req.headers.authorization;
        console.log('Meneruskan token ke API eksternal:', token);
        const response = await axios.get('https://gisapis.manpits.xyz/api/mkondisi', {
            headers: {
                Authorization: token
            }
        });
        res.json(response.data);
    } catch (err) {
        console.error('Gagal proxy mkondisi:', err.response?.status, err.response?.data || err.message);
        res.status(500).json({
            message: 'Gagal mengambil data mkondisi',
            error: err.response?.data || err.message,
            status: err.response?.status
        });
    }
});

app.listen(3000, (req, res) => {
    console.log('listening on port 3000......')
})
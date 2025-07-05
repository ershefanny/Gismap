document.addEventListener('DOMContentLoaded', () => {
    const selProv = document.getElementById('provinsi');
    const selKab = document.getElementById('kabupaten');
    const selKec = document.getElementById('kecamatan');
    const selDesa = document.getElementById('desa');

    console.log('Memulai fetch data region...');
    fetch('/api/mregion', {
        headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('token')}`
        }
    })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP status ${res.status}`);
        return res.json();
    })
    .then(data => {
        console.log('Respons sukses:', data);
        const { provinsi, kabupaten, kecamatan, desa } = data;

        document.getElementById('count-provinsi').textContent = provinsi.length;
        document.getElementById('count-kabupaten').textContent = kabupaten.length;
        document.getElementById('count-kecamatan').textContent = kecamatan.length;
        document.getElementById('count-desa').textContent = desa.length;

        selProv.innerHTML = '<option value="">Pilih provinsi...</option>';
        provinsi.forEach(p => {
            selProv.add(new Option(p.provinsi, p.id));
        });

        selProv.addEventListener('change', () => {
            const provId = +selProv.value;
            selKab.innerHTML = '<option value="">Pilih kabupaten...</option>';
            selKec.innerHTML = '<option value="">Pilih kecamatan...</option>';
            selDesa.innerHTML = '<option value="">Pilih desa...</option>';

            kabupaten
            .filter(k => k.prov_id === provId)
            .forEach(k => selKab.add(new Option(k.kabupaten, k.id)));
        });

        selKab.addEventListener('change', () => {
            const kabId = +selKab.value;
            selKec.innerHTML = '<option value="">Pilih kecamatan...</option>';
            selDesa.innerHTML = '<option value="">Pilih desa...</option>';

            kecamatan
            .filter(kc => kc.kab_id === kabId)
            .forEach(kc => selKec.add(new Option(kc.kecamatan, kc.id)));
        });

        selKec.addEventListener('change', () => {
            const kecId = +selKec.value;
            selDesa.innerHTML = '<option value="">Pilih desa...</option>';

            desa
            .filter(d => d.kec_id === kecId)
            .forEach(d => selDesa.add(new Option(d.desa, d.id)));
        });
    })
    .catch(error => {
        console.error('Gagal mengambil data region:', error);
        alert('Gagal mengambil data wilayah. Silakan coba lagi nanti.');
    });
});
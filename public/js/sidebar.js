document.addEventListener('DOMContentLoaded', () => {
    const sidebarContainer = document.getElementById('sidebar-container');

    if (sidebarContainer) {
        fetch('/partials/sidebar.html')
        .then(res => res.text())
        .then(html => {
            sidebarContainer.innerHTML = html;
            document.querySelector('#dashboard-btn')?.addEventListener('click', () => {
                window.location.href = '/';
            });
            
            document.querySelector('#region-btn')?.addEventListener('click', () => {
                window.location.href = '/region';
            });

            document.querySelector('.logout')?.addEventListener('click', () => {
                const token = sessionStorage.getItem('token');
                fetch('https://gisapis.manpits.xyz/api/logout', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(() => {
                    sessionStorage.clear();
                    window.location.href = '/login';
                }).catch(err => {
                    console.error(err);
                    alert('Logout gagal, tapi kamu akan dialihkan.');
                    sessionStorage.clear();
                    window.location.href = '/login';
                });
            });

            const mapsToggle = document.getElementById('maps-toggle');
            const mapsSubmenu = document.getElementById('maps-submenu');
            mapsToggle?.addEventListener('click', () => {
            mapsSubmenu.classList.toggle('hidden');
                if (mapsToggle.textContent.includes('▾')) {
                    mapsToggle.innerHTML = `<img src="/img/globe-simple.svg" class="icon" /> Maps ▴`;
                } else {
                mapsToggle.innerHTML = `<img src="/img/globe-simple.svg" class="icon" /> Maps ▾`;
                }
            });

            document.getElementById('manage-street')?.addEventListener('click', () => window.location.href = '/manage-street');
            document.getElementById('manage-marker')?.addEventListener('click', () => window.location.href = '/marker');
            document.getElementById('manage-polyline')?.addEventListener('click', () => window.location.href = '/polyline');
            document.getElementById('manage-polygon')?.addEventListener('click', () => window.location.href = '/polygon');
        });
    }
});
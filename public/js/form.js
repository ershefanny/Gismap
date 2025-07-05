const form = [...document.querySelector('.form').children];

form.forEach((item, i) => {
    setTimeout(() => {
        item.style.opacity = 1;
    }, i*100);
})

window.onload = () => {
    if(sessionStorage.name){
        location.href = '/';
    }
}

const name = document.querySelector('.name') || null;
const email = document.querySelector('.email');
const password = document.querySelector('.password');
const submitBtn = document.querySelector('.submit-btn');

if (name == null) {
    // login
    submitBtn.addEventListener('click', () => {
        fetch('https://gisapis.manpits.xyz/api/login', {
            method: 'POST',
            headers: new Headers({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                email: email.value,
                password: password.value
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.meta && data.meta.code === 200) {
                sessionStorage.setItem('token', data.meta.token);
                sessionStorage.setItem('email', email.value);
                sessionStorage.setItem('userId', data.meta.sub);
                sessionStorage.setItem('name', data.meta.name);
                location.href = '/';
            } else {
                alertBox(data.meta?.message || 'Login gagal');
            }
        })
        .catch(err => {
            console.error('Login error:', err);
            alertBox('Terjadi kesalahan saat login');
        });
    });
} else {
    // register
    submitBtn.addEventListener('click', () => {
        fetch('/register-user', {
            method: 'POST',
            headers: new Headers({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                name: name.value,
                email: email.value,
                password: password.value
            })
        })
        .then(res => res.json())
        .then(data => {
        console.log('Register response:', data);
        if (data.name) {
            alertBox('Registrasi berhasil! Silakan login.');
            setTimeout(() => location.href = '/login', 1500);
        } else {
            alertBox(data.message || 'Registrasi gagal');  
        }
        })
        .catch(err => {
            console.error('Register error:', err);
            alertBox('Terjadi kesalahan saat register');
        });
    });
}

const validateData = (data) => {
    if (!data.token) {
        alertBox(data.message || 'Login gagal');
    } else {
        sessionStorage.token = data.token;
        sessionStorage.email = data.email;
        sessionStorage.isLoggedIn = true;
        location.href = '/';
    }
};


const alertBox = (data) => {
    const alertContainer = document.querySelector('.alert-box');
    const alertMsg = document.querySelector('.alert');
    alertMsg.innerHTML = data;

    alertContainer.style.top = '5%';
    setTimeout(() => {
        alertContainer.style.top = null;
    }, 5000);
}
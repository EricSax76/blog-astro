import { registerUser } from '../lib/firebase/auth';

if (typeof window !== 'undefined') {
const registerForm = document.getElementById('register-form');
const messageContainer = document.getElementById('msg');

const formatError = (error) => {
	if (!error) return 'Error desconocido';
	const code = typeof error.code === 'string' ? error.code : null;
	const message = typeof error.message === 'string' ? error.message : String(error);
	return code ? `${code}: ${message}` : message;
};

const setMessage = (message, type = 'error') => {
	if (!messageContainer) return;
	messageContainer.textContent = message;
    messageContainer.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700'); // Clean slate
    
	if (type === 'success') {
        messageContainer.classList.add('bg-green-100', 'text-green-700', 'block');
    } else {
        messageContainer.classList.add('bg-red-100', 'text-red-700', 'block');
    }
    messageContainer.classList.remove('hidden');
};

if (registerForm) {
	registerForm.addEventListener('submit', async (event) => {
		event.preventDefault();

		const formData = new FormData(registerForm);
		const payload = Object.fromEntries(formData.entries());

		try {
			await registerUser({
				username: String(payload.username ?? ''),
				email: String(payload.email ?? ''),
				password: String(payload.password ?? ''),
				locale: 'es',
			});

			registerForm.reset();
			setMessage('¡Registro exitoso! Ahora puedes iniciar sesión.', 'success');
			window.location.assign('/user/login');
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('[registerUser] failed', error);
			setMessage(`No fue posible completar el registro. ${formatError(error)}`);
		}
	});
}
}

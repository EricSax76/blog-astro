if (typeof window !== 'undefined') {
	import('../lib/firebase/auth').then(({ loginAndResolveContext }) => {
		import('../lib/auth/navigation').then(({ redirectToDashboard }) => {
			const loginForm = document.getElementById('login-form');
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

			if (loginForm) {
				loginForm.addEventListener('submit', async (event) => {
					event.preventDefault();

					const formData = new FormData(loginForm);
					const payload = Object.fromEntries(formData.entries());
					const email = String(payload.email ?? '');
					const password = String(payload.password ?? '');

					try {
						const { context } = await loginAndResolveContext(email, password);
						redirectToDashboard(context);
					} catch (error) {
						// eslint-disable-next-line no-console
						console.error('[login] failed', error);
						setMessage(`No fue posible iniciar sesión. ${formatError(error)}`);
					}
				});
			}
		});
	});
}

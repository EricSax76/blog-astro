import { observeAuth, logout } from '../lib/firebase/auth';
import { getMyAccountContext, getMyUserProfile } from '../lib/firebase/profiles';
import { redirectToLogin } from '../lib/auth/navigation';

if (typeof window !== 'undefined') {
const profileContainer = document.getElementById('profile');
const logoutButton = document.getElementById('logout-btn');

const formatDate = (value) => {
	if (!value) return 'No disponible';
	const date = value?.toDate ? value.toDate() : new Date(value);
	return Number.isNaN(date.getTime()) ? 'No disponible' : date.toLocaleDateString();
};

const renderProfile = (user) => {
	if (!profileContainer) return;
	profileContainer.innerHTML = `
		<p><strong>Usuario:</strong> ${user.username || ''}</p>
		<p><strong>Email:</strong> ${user.email || ''}</p>
		<p><strong>Idioma:</strong> ${user.locale || 'es'}</p>
		<p><strong>Fecha de registro:</strong> ${formatDate(user.createdAt)}</p>
	`;
};

const renderMissingProfile = () => {
	if (!profileContainer) return;
	profileContainer.innerHTML = `
		<p>No encontramos tu perfil en Firestore.</p>
		<p>Si tu cuenta se creó fuera del formulario de registro, completa tu perfil.</p>
		<p><a href="/user/register">Completar registro</a></p>
	`;
};

if (logoutButton) {
	logoutButton.addEventListener('click', async () => {
		await logout().catch(() => {});
		window.location.assign('/');
	});
}

observeAuth(async (user) => {
	if (!user) {
		if (profileContainer) {
			profileContainer.innerHTML = '<p>Verificando sesión...</p>';
		}
		return;
	}

	const context = await getMyAccountContext(user);
	if (context.kind === 'terapeuta') {
		window.location.assign('/terapeuta');
		return;
	}

	const profile = await getMyUserProfile(user);
	if (!profile) {
		renderMissingProfile();
		return;
	}

	renderProfile(profile);
});
}

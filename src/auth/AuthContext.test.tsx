import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { SESSION_KEY } from './authService';

function Sonde() {
  const { isAuthenticated, signIn, signOut } = useAuth();
  return (
    <div>
      <span data-testid="etat">{isAuthenticated ? 'connecté' : 'déconnecté'}</span>
      <button onClick={() => void signIn('mor_2314', '83r5^_')}>connexion</button>
      <button onClick={signOut}>déconnexion</button>
    </div>
  );
}

function afficher() {
  return render(
    <AuthProvider>
      <Sonde />
    </AuthProvider>,
  );
}

beforeEach(() => sessionStorage.clear());

describe('AuthContext', () => {
  it('démarre déconnecté', () => {
    afficher();
    expect(screen.getByTestId('etat')).toHaveTextContent('déconnecté');
  });

  it('passe connecté après une connexion réussie', async () => {
    afficher();
    await userEvent.click(screen.getByRole('button', { name: 'connexion' }));
    expect(await screen.findByText('connecté')).toBeInTheDocument();
  });

  it('revient déconnecté après déconnexion', async () => {
    afficher();
    await userEvent.click(screen.getByRole('button', { name: 'connexion' }));
    await screen.findByText('connecté');
    await userEvent.click(screen.getByRole('button', { name: 'déconnexion' }));
    expect(screen.getByTestId('etat')).toHaveTextContent('déconnecté');
  });

  it('restaure une session existante au montage', () => {
    sessionStorage.setItem(SESSION_KEY, 'jeton-existant');
    afficher();
    expect(screen.getByTestId('etat')).toHaveTextContent('connecté');
  });

  it("échoue explicitement si useAuth est utilisé hors d'un AuthProvider", () => {
    expect(() => render(<Sonde />)).toThrow(/AuthProvider/);
  });
});

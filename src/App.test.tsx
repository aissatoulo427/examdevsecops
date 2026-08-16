import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';

beforeEach(() => sessionStorage.clear());

describe('App', () => {
  it("affiche le nom de l'application", () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Boutique' })).toBeInTheDocument();
  });

  it('exige une connexion avant de montrer le catalogue', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Catalogue' })).not.toBeInTheDocument();
  });

  it('donne accès au catalogue après une connexion réussie', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText('Identifiant'), 'mor_2314');
    await userEvent.type(screen.getByLabelText('Mot de passe'), '83r5^_');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('heading', { name: 'Catalogue' })).toBeInTheDocument();
  });

  it('affiche une erreur pour des identifiants invalides', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText('Identifiant'), 'mauvais');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'mauvais');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect/i);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewProjectForm } from '../../components/NewProjectForm';

describe('NewProjectForm', () => {
  it('new project form submits the selected preset, ratios and paths', async () => {
    const onSubmit = vi.fn();
    render(<NewProjectForm lang="en" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('radio', { name: /Faceless reel/ }));
    await userEvent.type(screen.getByLabelText('Project name'), 'Five free tools');
    await userEvent.click(screen.getByRole('checkbox', { name: '4:5' }));
    await userEvent.type(screen.getByLabelText('Input 1'), 'C:/Users/me/Masaüstü/çekimler');
    await userEvent.click(screen.getByRole('button', { name: 'Add another' }));
    await userEvent.type(screen.getByLabelText('Input 2'), 'C:/Users/me/vo.mp3');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Five free tools',
      mode: 'reel',
      preset: 'faceless',
      ratios: ['9:16', '4:5'],
      lang: 'en',
      inputs: ['C:/Users/me/Masaüstü/çekimler', 'C:/Users/me/vo.mp3'],
    });
  });

  it('talking head preset defaults ratios to 9:16, app video to 16:9', async () => {
    render(<NewProjectForm lang="en" onSubmit={() => {}} />);
    await userEvent.click(screen.getByRole('radio', { name: /Talking head/ }));
    expect((screen.getByRole('checkbox', { name: '9:16' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: '16:9' }) as HTMLInputElement).checked).toBe(false);
    await userEvent.click(screen.getByRole('radio', { name: /App video/ }));
    expect((screen.getByRole('checkbox', { name: '16:9' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: '9:16' }) as HTMLInputElement).checked).toBe(false);
  });

  it('shows the name error instead of submitting without a name', async () => {
    const onSubmit = vi.fn();
    render(<NewProjectForm lang="tr" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Oluştur' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Proje adı gerekli.')).toBeTruthy();
  });
});

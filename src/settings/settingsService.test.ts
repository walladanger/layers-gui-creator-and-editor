import { describe, it, expect, vi } from 'vitest';
import {
  createSettingsService,
  createMemorySettingsAdapter,
  createTauriSettingsAdapter,
  createRuntimeSettingsAdapter,
  defaultSettings
} from './settingsService';

describe('createMemorySettingsAdapter', () => {
  it('should read, write, clear, and return value', async () => {
    const adapter = createMemorySettingsAdapter('initial');
    expect(adapter.value()).toBe('initial');
    expect(await adapter.read()).toBe('initial');

    await adapter.write('new value');
    expect(adapter.value()).toBe('new value');
    expect(await adapter.read()).toBe('new value');

    await adapter.clear();
    expect(adapter.value()).toBe(null);
    expect(await adapter.read()).toBe(null);
  });
});

describe('createTauriSettingsAdapter', () => {
  it('should call command with correct arguments', async () => {
    const mockCommand = vi.fn().mockImplementation(async (cmd) => {
      if (cmd === 'load_settings') return 'loaded';
      return undefined;
    });

    const adapter = createTauriSettingsAdapter(mockCommand);

    expect(await adapter.read()).toBe('loaded');
    expect(mockCommand).toHaveBeenCalledWith('load_settings');

    await adapter.write('content');
    expect(mockCommand).toHaveBeenCalledWith('save_settings', { content: 'content' });

    await adapter.clear();
    expect(mockCommand).toHaveBeenCalledWith('clear_settings');
  });
});

describe('createRuntimeSettingsAdapter', () => {
  it('returns Tauri adapter when isTauri is true', async () => {
    const mockCommand = vi.fn().mockResolvedValue('tauri-data');
    const adapter = createRuntimeSettingsAdapter(true, mockCommand);
    expect(await adapter.read()).toBe('tauri-data');
    expect(mockCommand).toHaveBeenCalledWith('load_settings');
  });

  it('returns Memory adapter when isTauri is false', async () => {
    const mockCommand = vi.fn();
    const adapter = createRuntimeSettingsAdapter(false, mockCommand);
    expect(await adapter.read()).toBe(null); // initial memory is null
    expect(mockCommand).not.toHaveBeenCalled();
  });
});

describe('createSettingsService', () => {
  describe('load()', () => {
    it('returns defaultSettings if adapter returns null', async () => {
      const adapter = createMemorySettingsAdapter(null);
      const service = createSettingsService(adapter);
      expect(await service.load()).toEqual(defaultSettings);
    });

    it('returns defaultSettings if JSON is invalid', async () => {
      const adapter = createMemorySettingsAdapter('{ invalid json');
      const service = createSettingsService(adapter);
      expect(await service.load()).toEqual(defaultSettings);
    });

    it('returns defaultSettings if loaded data does not match AppSettings schema', async () => {
      const adapter = createMemorySettingsAdapter(JSON.stringify({ version: 2 }));
      const service = createSettingsService(adapter);
      expect(await service.load()).toEqual(defaultSettings);
    });

    it('returns parsed settings if data is valid', async () => {
      const validSettings = {
        version: 1,
        colorProfile: { family: 'sky', shade: 400 },
        navigationCollapsed: true,
        recentFiles: ['/path/to/file'],
        windowBehavior: { restoreOnLaunch: false, rememberBounds: true },
        extensionSettings: { someKey: 'someValue' },
      };
      const adapter = createMemorySettingsAdapter(JSON.stringify(validSettings));
      const service = createSettingsService(adapter);
      expect(await service.load()).toEqual(validSettings);
    });

    it('returns defaultSettings if adapter throws', async () => {
      const adapter = {
        read: vi.fn().mockRejectedValue(new Error('Read failed')),
        write: vi.fn(),
        clear: vi.fn(),
      };
      const service = createSettingsService(adapter);
      expect(await service.load()).toEqual(defaultSettings);
    });
  });

  describe('save()', () => {
    it('saves stringified settings via adapter and returns success', async () => {
      const adapter = createMemorySettingsAdapter();
      const service = createSettingsService(adapter);

      const result = await service.save(defaultSettings);
      expect(result).toEqual({ kind: 'success' });
      expect(adapter.value()).toBe(JSON.stringify(defaultSettings));
    });

    it('returns failure if adapter throws', async () => {
      const adapter = {
        read: vi.fn(),
        write: vi.fn().mockRejectedValue(new Error('Write failed')),
        clear: vi.fn(),
      };
      const service = createSettingsService(adapter);

      const result = await service.save(defaultSettings);
      expect(result).toEqual({ kind: 'failure', code: 'persistence-failed' });
    });
  });

  describe('reset()', () => {
    it('clears the adapter and returns default settings', async () => {
      const adapter = createMemorySettingsAdapter('some data');
      const service = createSettingsService(adapter);

      const result = await service.reset();
      expect(result).toEqual(defaultSettings);
      expect(adapter.value()).toBe(null);
    });

    it('returns default settings even if adapter clear throws', async () => {
      const adapter = {
        read: vi.fn(),
        write: vi.fn(),
        clear: vi.fn().mockRejectedValue(new Error('Clear failed')),
      };
      const service = createSettingsService(adapter);

      const result = await service.reset();
      expect(result).toEqual(defaultSettings);
    });
  });
});

describe('isAppSettings validation edge cases', () => {
  it('rejects invalid color profiles', async () => {
    const invalidSettings = { ...defaultSettings, colorProfile: { family: 'invalid-family', shade: 400 } };
    const adapter = createMemorySettingsAdapter(JSON.stringify(invalidSettings));
    const service = createSettingsService(adapter);
    expect(await service.load()).toEqual(defaultSettings);
  });

  it('rejects null extensionSettings', async () => {
    const invalidSettings = { ...defaultSettings, extensionSettings: null };
    const adapter = createMemorySettingsAdapter(JSON.stringify(invalidSettings));
    const service = createSettingsService(adapter);
    expect(await service.load()).toEqual(defaultSettings);
  });

  it('rejects array extensionSettings', async () => {
    const invalidSettings = { ...defaultSettings, extensionSettings: [] };
    const adapter = createMemorySettingsAdapter(JSON.stringify(invalidSettings));
    const service = createSettingsService(adapter);
    expect(await service.load()).toEqual(defaultSettings);
  });
});

import { describe, expect, expectTypeOf, test } from 'vitest';
import type {
  ConfirmDocumentDiscard,
  DocumentFormat,
  DocumentOperationState,
  DocumentService,
  DocumentServiceOptions,
  DocumentState,
  FileErrorCode,
  FileOperationResult,
  TextDocument,
  TextDocumentAdapter,
} from './fileTypes';

describe('fileTypes', () => {
  test('has no runtime exports', async () => {
    // We import dynamically to check the runtime exports of the module.
    // If it only contains types, there should be no runtime exports.
    const module = await import('./fileTypes');
    expect(Object.keys(module)).toEqual([]);
  });

  test('DocumentFormat is specific to text', () => {
    expectTypeOf<DocumentFormat>().toEqualTypeOf<'text'>();
  });

  test('TextDocument structure', () => {
    expectTypeOf<TextDocument>().toMatchTypeOf<{
      format: DocumentFormat;
      path: string | null;
      content: string;
      dirty: boolean;
    }>();
  });

  test('FileErrorCode includes expected error types', () => {
    expectTypeOf<FileErrorCode>().toEqualTypeOf<'not-found' | 'permission-denied' | 'unknown'>();
  });

  test('FileOperationResult discriminated union types', () => {
    type Success = Extract<FileOperationResult, { kind: 'success' }>;
    expectTypeOf<Success>().toMatchTypeOf<{ kind: 'success'; document: TextDocument }>();

    type Cancelled = Extract<FileOperationResult, { kind: 'cancelled' }>;
    expectTypeOf<Cancelled>().toMatchTypeOf<{ kind: 'cancelled' }>();

    type Failure = Extract<FileOperationResult, { kind: 'failure' }>;
    expectTypeOf<Failure>().toMatchTypeOf<{ kind: 'failure'; code: FileErrorCode; message?: string }>();
  });

  test('DocumentOperationState values', () => {
    expectTypeOf<DocumentOperationState>().toEqualTypeOf<'idle' | 'loading' | 'success' | 'failure'>();
  });

  test('DocumentState structure includes all fields', () => {
    expectTypeOf<DocumentState>().toMatchTypeOf<{
      status: DocumentOperationState;
      document: TextDocument | null;
      currentPath: string | null;
      recentFiles: readonly string[];
      error?: Extract<FileOperationResult, { kind: 'failure' }>;
    }>();
  });

  test('TextDocumentAdapter methods and parameters', () => {
    type Adapter = TextDocumentAdapter;
    expectTypeOf<Adapter['chooseOpenPath']>().toMatchTypeOf<(signal?: AbortSignal) => Promise<string | null>>();
    expectTypeOf<Adapter['chooseSavePath']>().toMatchTypeOf<(suggestedPath?: string, signal?: AbortSignal) => Promise<string | null>>();
    expectTypeOf<Adapter['readText']>().toMatchTypeOf<(path: string, signal?: AbortSignal) => Promise<string>>();
    expectTypeOf<Adapter['writeText']>().toMatchTypeOf<(path: string, content: string, signal?: AbortSignal) => Promise<void>>();
  });

  test('ConfirmDocumentDiscard function signature', () => {
    expectTypeOf<ConfirmDocumentDiscard>().toMatchTypeOf<(document: TextDocument) => Promise<boolean>>();
  });

  test('DocumentServiceOptions allows optional discard confirmation', () => {
    expectTypeOf<DocumentServiceOptions>().toMatchTypeOf<{ confirmDiscard?: ConfirmDocumentDiscard }>();
  });

  test('DocumentService API structure', () => {
    type Service = DocumentService;
    expectTypeOf<Service['getState']>().toMatchTypeOf<() => DocumentState>();
    expectTypeOf<Service['subscribe']>().toMatchTypeOf<(listener: () => void) => () => void>();
    expectTypeOf<Service['newDocument']>().toMatchTypeOf<(content?: string) => Promise<FileOperationResult>>();
    expectTypeOf<Service['open']>().toMatchTypeOf<() => Promise<FileOperationResult>>();
    expectTypeOf<Service['load']>().toMatchTypeOf<(path: string) => Promise<FileOperationResult>>();
    expectTypeOf<Service['save']>().toMatchTypeOf<() => Promise<FileOperationResult>>();
    expectTypeOf<Service['saveAs']>().toMatchTypeOf<() => Promise<FileOperationResult>>();
    expectTypeOf<Service['cancel']>().toMatchTypeOf<() => void>();
    expectTypeOf<Service['updateContent']>().toMatchTypeOf<(content: string) => void>();
  });
});

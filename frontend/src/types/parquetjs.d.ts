declare module 'parquetjs' {
  export class ParquetReader {
    static openFile(filePath: string): Promise<ParquetReader>
    getCursor(): ParquetCursor
    close(): Promise<void>
  }

  export interface ParquetCursor {
    next(): Promise<Record<string, any> | null>
  }

  export class ParquetSchema {
    constructor(schema: Record<string, any>)
  }

  export class ParquetWriter {
    static openFile(schema: ParquetSchema, filePath: string): Promise<ParquetWriter>
    appendRow(row: Record<string, any>): Promise<void>
    close(): Promise<void>
  }
}

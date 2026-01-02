import { Injectable } from '@angular/core';
import { environment } from '../config';
import { Expense } from './expense.service';
import { GoogleApiService } from './google-api.service';

declare var gapi: any;

@Injectable({
  providedIn: 'root'
})
export class SheetsService {

  private expensesSheetName: string = 'Spending';

  constructor(private googleApiService: GoogleApiService) { }

  async getExpenses(): Promise<Expense[]> {
    await this.googleApiService.ensureInitialized();
    try {
      // 1. Discover the correct sheet name if not sure
      const spreadsheet = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId: environment.google.spreadsheetId
      });

      const sheets = spreadsheet.result.sheets;

      // Find first sheet that is NOT 'Categories'
      const mainSheet = sheets.find((s: any) => s.properties.title !== 'Categories');
      if (mainSheet) {
        this.expensesSheetName = mainSheet.properties.title;
      }

      const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: environment.google.spreadsheetId,
        range: `${this.expensesSheetName}!A:E`,
      });

      const rows = response.result.values;
      if (!rows || rows.length === 0) {
        return [];
      }

      // Skip header row if exists (simple check: if first col is 'ID')
      const startIdx = rows[0][0] === 'ID' ? 1 : 0;

      return rows.slice(startIdx).map((row: any[]) => ({
        id: Number(row[0]),
        date: row[1],
        category: row[2],
        amount: Number(row[3]),
        note: row[4]
      }));
    } catch (error) {
      console.error('Error fetching from Sheets:', error);
      return [];
    }
  }

  async addExpense(expense: Expense): Promise<void> {
    await this.googleApiService.ensureInitialized();
    const values = [
      [
        expense.id,
        expense.date,
        expense.category,
        expense.amount,
        expense.note
      ]
    ];

    try {
      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: environment.google.spreadsheetId,
        range: `${this.expensesSheetName}!A:E`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: values
        }
      });
    } catch (error) {
      console.error('Error adding to Sheets:', error);
      throw error;
    }
  }

  async findRowIndexById(id: number): Promise<number> {
    await this.googleApiService.ensureInitialized();
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: environment.google.spreadsheetId,
      range: `${this.expensesSheetName}!A:A`,
    });
    const rows = response.result.values;
    if (!rows) return -1;

    // Assuming ID is in column A (index 0)
    // Rows are 0-indexed in array, but 1-indexed in Sheets.
    // Row 1 is header. Data starts at Row 2.
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] == id) {
        return i + 1; // Return 1-based row number
      }
    }
    return -1;
  }

  async updateExpense(expense: Expense): Promise<void> {
    await this.googleApiService.ensureInitialized();
    const rowIndex = await this.findRowIndexById(expense.id);
    if (rowIndex === -1) throw new Error('Expense not found');

    const values = [
      [
        expense.id,
        expense.date,
        expense.category,
        expense.amount,
        expense.note
      ]
    ];

    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: environment.google.spreadsheetId,
      range: `${this.expensesSheetName}!A${rowIndex}:E${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: values }
    });
  }

  async deleteExpense(id: number): Promise<void> {
    await this.googleApiService.ensureInitialized();
    const rowIndex = await this.findRowIndexById(id);
    if (rowIndex === -1) throw new Error('Expense not found');

    // Delete the row
    // We need the sheetId (integer), not the sheet name (string)
    const spreadsheet = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId: environment.google.spreadsheetId
    });
    const sheet = spreadsheet.result.sheets.find((s: any) => s.properties.title === this.expensesSheetName);
    if (!sheet) throw new Error('Sheet not found');
    const sheetId = sheet.properties.sheetId;

    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: environment.google.spreadsheetId,
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1, // 0-based inclusive
              endIndex: rowIndex // 0-based exclusive
            }
          }
        }]
      }
    });
  }

  // --- Import Feature ---

  async importExpenses(sourceSpreadsheetIds: string[], progressCallback: (msg: string) => void): Promise<{ imported: number, errors: number }> {
    await this.googleApiService.ensureInitialized();
    let totalImported = 0;
    let totalErrors = 0;

    // 1. Fetch existing data to prevent duplicates
    progressCallback('Fetching existing data to check for duplicates...');
    const existingExpenses = await this.getExpenses();
    const existingSignatures = new Set(existingExpenses.map(e => `${e.date}-${e.amount}-${e.note}`));

    for (const spreadsheetId of sourceSpreadsheetIds) {
      if (!spreadsheetId.trim()) continue;

      try {
        progressCallback(`Processing Spreadsheet: ${spreadsheetId}`);

        // 2. Get all tabs
        const spreadsheet = await gapi.client.sheets.spreadsheets.get({
          spreadsheetId: spreadsheetId
        });

        const sheets = spreadsheet.result.sheets;

        for (const sheet of sheets) {
          const title = sheet.properties.title;
          progressCallback(`  > Reading tab: ${title}`);

          try {
            // 3. Read data from tab (Columns A-D)
            const response = await gapi.client.sheets.spreadsheets.values.get({
              spreadsheetId: spreadsheetId,
              range: `${title}!A:D`
            });

            const rows = response.result.values;
            if (!rows || rows.length < 2) {
              progressCallback(`    Skipping empty/header-only tab.`);
              continue;
            }

            const newRows: any[] = [];

            // 4. Process rows (Skip header)
            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              // Source: Date(0), Purpose(1), Expense(2), Description(3)
              const date = row[0];
              const purpose = row[1] || 'Uncategorized';
              const expenseStr = row[2];
              const description = row[3] || '';

              // Validation
              if (!date || !expenseStr) continue;

              const amount = parseFloat(expenseStr.replace(/[^0-9.-]+/g, ""));
              if (isNaN(amount)) continue;

              // Duplicate Check
              const signature = `${date}-${amount}-${description}`;
              if (existingSignatures.has(signature)) {
                continue; // Skip duplicate
              }

              // Mapping
              // Dest: ID, Date, Category, Amount, Note
              const newExpense = [
                Date.now() + Math.random(), // Unique ID
                date,
                purpose, // Map Purpose -> Category
                amount,
                description // Map Description -> Note
              ];

              newRows.push(newExpense);
              existingSignatures.add(signature); // Add to local set to prevent dups within same import
            }

            // 5. Batch Append
            if (newRows.length > 0) {
              await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: environment.google.spreadsheetId,
                range: `${this.expensesSheetName}!A:E`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: newRows }
              });
              totalImported += newRows.length;
              progressCallback(`    Imported ${newRows.length} rows.`);
            }

          } catch (err) {
            console.error(`Error reading tab ${title}:`, err);
            progressCallback(`    Error reading tab ${title}.`);
            totalErrors++;
          }
        }

      } catch (err) {
        console.error(`Error processing spreadsheet ${spreadsheetId}:`, err);
        progressCallback(`  Error processing spreadsheet. Check ID and Permissions.`);
        totalErrors++;
      }
    }

    return { imported: totalImported, errors: totalErrors };
  }

  // --- Category Management ---

  async ensureCategoriesTab(): Promise<void> {
    await this.googleApiService.ensureInitialized();
    try {
      const spreadsheet = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId: environment.google.spreadsheetId
      });

      const sheets = spreadsheet.result.sheets;
      const categoriesSheet = sheets.find((s: any) => s.properties.title === 'Categories');

      if (!categoriesSheet) {
        // Create Categories sheet
        await gapi.client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: environment.google.spreadsheetId,
          resource: {
            requests: [{
              addSheet: {
                properties: { title: 'Categories' }
              }
            }]
          }
        });

        // Add Headers: CategoryID, CategoryName, ParentCategoryID
        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: environment.google.spreadsheetId,
          range: 'Categories!A1:C1',
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [['CategoryID', 'CategoryName', 'ParentCategoryID']]
          }
        });
      }
    } catch (error) {
      console.error('Error ensuring Categories tab:', error);
    }
  }

  async getCategories(): Promise<any[]> {
    await this.googleApiService.ensureInitialized();
    try {
      const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: environment.google.spreadsheetId,
        range: 'Categories!A:C'
      });

      const rows = response.result.values;
      if (!rows || rows.length < 2) return []; // Header only or empty

      // Skip header
      return rows.slice(1).map((row: any[]) => ({
        id: row[0],
        name: row[1],
        parentId: row[2] === 'NULL' ? null : row[2]
      }));
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  }

  async addCategory(id: string, name: string, parentId: string | null): Promise<void> {
    await this.googleApiService.ensureInitialized();
    try {
      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: environment.google.spreadsheetId,
        range: 'Categories!A:C',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[id, name, parentId || 'NULL']]
        }
      });
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  }

  async updateCategory(id: string, newName: string): Promise<void> {
    await this.googleApiService.ensureInitialized();
    try {
      const categories = await this.getCategories();
      const rowIndex = categories.findIndex(c => c.id === id);
      if (rowIndex === -1) throw new Error('Category not found');

      // Row index in array is 0-based. In Sheets, it's 1-based.
      // Header is row 1. Data starts at row 2.
      // So array index 0 is row 2.
      const sheetRow = rowIndex + 2;

      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: environment.google.spreadsheetId,
        range: `Categories!B${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[newName]]
        }
      });
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  async deleteCategory(id: string): Promise<void> {
    await this.googleApiService.ensureInitialized();
    try {
      const categories = await this.getCategories();
      const rowIndex = categories.findIndex(c => c.id === id);
      if (rowIndex === -1) throw new Error('Category not found');

      const sheetRow = rowIndex + 2;

      const spreadsheet = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId: environment.google.spreadsheetId
      });
      const sheet = spreadsheet.result.sheets.find((s: any) => s.properties.title === 'Categories');
      if (!sheet) throw new Error('Categories sheet not found');
      const sheetId = sheet.properties.sheetId;

      await gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: environment.google.spreadsheetId,
        resource: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: sheetRow - 1, // 0-based inclusive
                endIndex: sheetRow // 0-based exclusive
              }
            }
          }]
        }
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  async importCategoriesFromExpenses(): Promise<number> {
    await this.googleApiService.ensureInitialized();
    try {
      // 0. Check Auth
      const token = gapi.client.getToken();
      if (!token) {
        console.error('DEBUG: No Access Token found!');
        alert('Please sign in with Google first.');
        return 0;
      }
      console.log('DEBUG: Access Token present.');

      // 1. Get all expenses
      const expenses = await this.getExpenses();
      console.log('DEBUG: Fetched Expenses Count:', expenses.length);

      if (expenses.length === 0) return 0;

      // 2. Get existing categories
      const existingCats = await this.getCategories();
      console.log('DEBUG: Existing Categories:', existingCats);
      const existingNames = new Set(existingCats.map(c => c.name.toLowerCase()));

      // 3. Find unique new categories
      const newCategories = new Set<string>();
      expenses.forEach(e => {
        if (e.category && !existingNames.has(e.category.toLowerCase())) {
          newCategories.add(e.category);
        }
      });

      console.log('DEBUG: New Unique Categories Found:', Array.from(newCategories));

      if (newCategories.size === 0) return 0;

      // 4. Prepare rows
      const newRows = Array.from(newCategories).map(name => [
        Date.now().toString(36) + Math.random().toString(36).substr(2), // Unique ID
        name,
        'NULL' // Top-level
      ]);

      // 5. Batch append
      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: environment.google.spreadsheetId,
        range: 'Categories!A:C',
        valueInputOption: 'USER_ENTERED',
        resource: { values: newRows }
      });

      return newRows.length;
    } catch (error) {
      console.error('Error importing categories from expenses:', error);
      throw error;
    }
  }
}

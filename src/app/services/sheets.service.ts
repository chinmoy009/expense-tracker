import { Injectable } from '@angular/core';
import { environment } from '../config';
import { Expense } from './expense.service';
import { GoogleApiService } from './google-api.service';
import { Bank, BankTransaction } from '../models/bank.model';
import { LoanTransaction } from '../models/loan.model';

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
        range: `${this.expensesSheetName}!A:F`,
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
        note: row[4],
        bankId: row[5] || undefined
      }));
    } catch (error) {
      console.error('Error fetching from Sheets:', error);
      return [];
    }
  }

  async addExpense(expense: Expense): Promise<void> {
    await this.googleApiService.ensureInitialized();
    try {
      const values = [[
        expense.id,
        expense.date,
        expense.category,
        expense.amount,
        expense.note,
        expense.bankId || ''
      ]];

      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: environment.google.spreadsheetId,
        range: `${this.expensesSheetName}!A:F`,
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

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] == id) {
        return i + 1; // 1-indexed for Sheets
      }
    }
    return -1;
  }

  async updateExpense(expense: Expense): Promise<void> {
    await this.googleApiService.ensureInitialized();
    try {
      const rowIndex = await this.findRowIndexById(expense.id);
      if (rowIndex === -1) throw new Error('Expense not found');

      const values = [[
        expense.id,
        expense.date,
        expense.category,
        expense.amount,
        expense.note,
        expense.bankId || ''
      ]];

      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: environment.google.spreadsheetId,
        range: `${this.expensesSheetName}!A${rowIndex}:F${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: values
        }
      });
    } catch (error) {
      console.error('Error updating in Sheets:', error);
      throw error;
    }
  }

  async deleteExpense(id: number): Promise<void> {
    await this.googleApiService.ensureInitialized();
    const rowIndex = await this.findRowIndexById(id);
    if (rowIndex === -1) throw new Error('Expense not found');

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
              startIndex: rowIndex - 1,
              endIndex: rowIndex
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

  // --- Bank Module ---

  async ensureBanksTab(): Promise<void> {
    await this.googleApiService.ensureInitialized();
    try {
      const spreadsheet = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId: environment.google.spreadsheetId
      });

      const sheets = spreadsheet.result.sheets;
      const banksSheet = sheets.find((s: any) => s.properties.title === 'Banks');

      if (!banksSheet) {
        await gapi.client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: environment.google.spreadsheetId,
          resource: {
            requests: [{
              addSheet: {
                properties: { title: 'Banks' }
              }
            }]
          }
        });

        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: environment.google.spreadsheetId,
          range: 'Banks!A1:M1',
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [[
              'ID', 'Bank Name', 'Bank Code', 'Account Name', 'Account Number',
              'Account Type', 'Home Branch', 'Branch Zone', 'Branch District',
              'Opening Balance', 'IsClosed', 'CreatedAt', 'UpdatedAt'
            ]]
          }
        });
      }
    } catch (error) {
      console.error('Error ensuring Banks tab:', error);
    }
  }

  async ensureBankTransactionsTab(): Promise<void> {
    await this.googleApiService.ensureInitialized();
    try {
      const spreadsheet = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId: environment.google.spreadsheetId
      });

      const sheets = spreadsheet.result.sheets;
      const transSheet = sheets.find((s: any) => s.properties.title === 'Bank Transactions');

      if (!transSheet) {
        await gapi.client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: environment.google.spreadsheetId,
          resource: {
            requests: [{
              addSheet: {
                properties: { title: 'Bank Transactions' }
              }
            }]
          }
        });

        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: environment.google.spreadsheetId,
          range: 'Bank Transactions!A1:H1',
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [[
              'Bank ID', 'Transaction Type', 'Amount', 'Date', 'Details',
              'Transaction ID', 'CreatedAt', 'UpdatedAt'
            ]]
          }
        });
      }
    } catch (error) {
      console.error('Error ensuring Bank Transactions tab:', error);
    }
  }

  async getBanks(): Promise<Bank[]> {
    await this.googleApiService.ensureInitialized();
    try {
      const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: environment.google.spreadsheetId,
        range: 'Banks!A:M'
      });

      const rows = response.result.values;
      if (!rows || rows.length < 2) return [];

      return rows.slice(1).map((row: any[]) => ({
        id: row[0],
        bankName: row[1],
        bankCode: row[2],
        accountName: row[3],
        accountNumber: row[4],
        accountType: row[5],
        homeBranch: row[6],
        branchZone: row[7],
        branchDistrict: row[8],
        openingBalance: Number(row[9]),
        isClosed: row[10] === 'TRUE',
        createdAt: row[11],
        updatedAt: row[12]
      }));
    } catch (error) {
      console.error('Error fetching banks:', error);
      return [];
    }
  }

  async addBank(bank: Bank): Promise<void> {
    await this.googleApiService.ensureInitialized();
    try {
      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: environment.google.spreadsheetId,
        range: 'Banks!A:M',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[
            bank.id, bank.bankName, bank.bankCode, bank.accountName, bank.accountNumber,
            bank.accountType, bank.homeBranch, bank.branchZone, bank.branchDistrict,
            bank.openingBalance, bank.isClosed, bank.createdAt, bank.updatedAt
          ]]
        }
      });
    } catch (error) {
      console.error('Error adding bank:', error);
      throw error;
    }
  }

  async updateBank(bank: Bank): Promise<void> {
    await this.googleApiService.ensureInitialized();
    try {
      const banks = await this.getBanks();
      const rowIndex = banks.findIndex(b => b.id === bank.id);
      if (rowIndex === -1) throw new Error('Bank not found');

      const sheetRow = rowIndex + 2;
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: environment.google.spreadsheetId,
        range: `Banks!A${sheetRow}:M${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[
            bank.id, bank.bankName, bank.bankCode, bank.accountName, bank.accountNumber,
            bank.accountType, bank.homeBranch, bank.branchZone, bank.branchDistrict,
            bank.openingBalance, bank.isClosed, bank.createdAt, bank.updatedAt
          ]]
        }
      });
    } catch (error) {
      console.error('Error updating bank:', error);
      throw error;
    }
  }

  async getBankTransactions(): Promise<BankTransaction[]> {
    await this.googleApiService.ensureInitialized();
    try {
      const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: environment.google.spreadsheetId,
        range: 'Bank Transactions!A:H'
      });

      const rows = response.result.values;
      if (!rows || rows.length < 2) return [];

      return rows.slice(1).map((row: any[]) => ({
        bankId: row[0],
        type: row[1] as 'DEBIT' | 'CREDIT',
        amount: Number(row[2]),
        date: row[3],
        details: row[4],
        id: row[5],
        createdAt: row[6],
        updatedAt: row[7]
      }));
    } catch (error) {
      console.error('Error fetching bank transactions:', error);
      return [];
    }
  }

  async addBankTransaction(tx: BankTransaction): Promise<void> {
    await this.googleApiService.ensureInitialized();
    try {
      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: environment.google.spreadsheetId,
        range: 'Bank Transactions!A:H',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[
            tx.bankId, tx.type, tx.amount, tx.date, tx.details, tx.id, tx.createdAt, tx.updatedAt
          ]]
        }
      });
    } catch (error) {
      console.error('Error adding bank transaction:', error);
      throw error;
    }
  }

  async updateBankTransaction(tx: BankTransaction): Promise<void> {
    await this.googleApiService.ensureInitialized();
    try {
      const txs = await this.getBankTransactions();
      const rowIndex = txs.findIndex(t => t.id === tx.id);
      if (rowIndex === -1) throw new Error('Transaction not found');

      const sheetRow = rowIndex + 2;
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: environment.google.spreadsheetId,
        range: `Bank Transactions!A${sheetRow}:H${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[
            tx.bankId, tx.type, tx.amount, tx.date, tx.details, tx.id, tx.createdAt, tx.updatedAt
          ]]
        }
      });
    } catch (error) {
      console.error('Error updating bank transaction:', error);
      throw error;
    }
  }

  async deleteBankTransaction(id: string): Promise<void> {
    await this.googleApiService.ensureInitialized();
    try {
      const txs = await this.getBankTransactions();
      const rowIndex = txs.findIndex(t => t.id === id);
      if (rowIndex === -1) throw new Error('Transaction not found');

      const sheetRow = rowIndex + 2;
      const spreadsheet = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId: environment.google.spreadsheetId
      });
      const sheet = spreadsheet.result.sheets.find((s: any) => s.properties.title === 'Bank Transactions');
      if (!sheet) throw new Error('Bank Transactions sheet not found');
      const sheetId = sheet.properties.sheetId;

      await gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: environment.google.spreadsheetId,
        resource: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: sheetRow - 1,
                endIndex: sheetRow
              }
            }
          }]
        }
      });
    } catch (error) {
      console.error('Error deleting bank transaction:', error);
      throw error;
    }
  }
  // --- Loan Management ---

  async ensureLoanTransactionsTab(): Promise<void> {
    await this.googleApiService.ensureInitialized();
    try {
      const spreadsheet = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId: environment.google.spreadsheetId
      });

      const sheets = spreadsheet.result.sheets;
      const loanSheet = sheets.find((s: any) => s.properties.title === 'Loan Transactions');

      if (!loanSheet) {
        await gapi.client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: environment.google.spreadsheetId,
          resource: {
            requests: [{
              addSheet: {
                properties: { title: 'Loan Transactions' }
              }
            }]
          }
        });

        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: environment.google.spreadsheetId,
          range: 'Loan Transactions!A1:H1',
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [[
              'ID', 'Name', 'User Received', 'User Gave', 'Date',
              'Medium', 'CreatedAt', 'UpdatedAt'
            ]]
          }
        });
      }
    } catch (error) {
      console.error('Error ensuring Loan Transactions tab:', error);
    }
  }

  async getLoanTransactions(): Promise<LoanTransaction[]> {
    await this.googleApiService.ensureInitialized();
    try {
      const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: environment.google.spreadsheetId,
        range: 'Loan Transactions!A:H'
      });

      const rows = response.result.values;
      if (!rows || rows.length < 2) return [];

      return rows.slice(1).map((row: any[]) => ({
        id: row[0],
        name: row[1],
        userReceived: Number(row[2]),
        userGave: Number(row[3]),
        date: row[4],
        medium: row[5],
        createdAt: row[6],
        updatedAt: row[7]
      }));
    } catch (error) {
      console.error('Error fetching loan transactions:', error);
      return [];
    }
  }

  async addLoanTransaction(tx: LoanTransaction): Promise<void> {
    await this.googleApiService.ensureInitialized();
    try {
      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: environment.google.spreadsheetId,
        range: 'Loan Transactions!A:H',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[
            tx.id, tx.name, tx.userReceived, tx.userGave, tx.date,
            tx.medium, tx.createdAt, tx.updatedAt
          ]]
        }
      });
    } catch (error) {
      console.error('Error adding loan transaction:', error);
      throw error;
    }
  }

  async updateLoanTransaction(tx: LoanTransaction): Promise<void> {
    await this.googleApiService.ensureInitialized();
    try {
      const txs = await this.getLoanTransactions();
      const rowIndex = txs.findIndex(t => t.id === tx.id);
      if (rowIndex === -1) throw new Error('Loan Transaction not found');

      const sheetRow = rowIndex + 2;
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: environment.google.spreadsheetId,
        range: `Loan Transactions!A${sheetRow}:H${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[
            tx.id, tx.name, tx.userReceived, tx.userGave, tx.date,
            tx.medium, tx.createdAt, tx.updatedAt
          ]]
        }
      });
    } catch (error) {
      console.error('Error updating loan transaction:', error);
      throw error;
    }
  }

  async deleteLoanTransaction(id: string): Promise<void> {
    await this.googleApiService.ensureInitialized();
    try {
      const txs = await this.getLoanTransactions();
      const rowIndex = txs.findIndex(t => t.id === id);
      if (rowIndex === -1) throw new Error('Loan Transaction not found');

      const sheetRow = rowIndex + 2;
      const spreadsheet = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId: environment.google.spreadsheetId
      });
      const sheet = spreadsheet.result.sheets.find((s: any) => s.properties.title === 'Loan Transactions');
      if (!sheet) throw new Error('Loan Transactions sheet not found');
      const sheetId = sheet.properties.sheetId;

      await gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: environment.google.spreadsheetId,
        resource: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: sheetRow - 1,
                endIndex: sheetRow
              }
            }
          }]
        }
      });
    } catch (error) {
      console.error('Error deleting loan transaction:', error);
      throw error;
    }
  }
}

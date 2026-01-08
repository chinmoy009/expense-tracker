export interface Bank {
    id: string;
    bankName: string;
    bankCode: string;
    accountName: string;
    accountNumber: string;
    accountType: string;
    homeBranch: string;
    branchZone: string;
    branchDistrict: string;
    openingBalance: number;
    isClosed: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface BankTransaction {
    id: string;
    bankId: string;
    type: 'DEBIT' | 'CREDIT';
    amount: number;
    date: string;
    details: string;
    createdAt: string;
    updatedAt: string;
}

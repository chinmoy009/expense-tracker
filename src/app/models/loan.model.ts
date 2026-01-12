export interface LoanTransaction {
    id: string; // LTX-001
    name: string;
    userReceived: number;
    userGave: number;
    date: string;
    medium: string; // Bank ID or "Cash" etc.
    createdAt: string;
    updatedAt: string;
}

export interface LoanSummary {
    name: string;
    totalReceived: number;
    totalGave: number;
    balance: number;
}

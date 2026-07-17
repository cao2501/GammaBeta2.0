export interface ReactBill {
  id: string;
  guildId: string;
  title: string;
  description?: string;
  participants: string[]; // List of Discord User IDs
  managerChannelId: string;
  managerMessageId: string;
  voterChannelId?: string;
  voterMessageId?: string;
}

export class ReactBillManager {
  private static bills = new Map<string, ReactBill>();

  public static createBill(bill: ReactBill) {
    this.bills.set(bill.id, bill);
  }

  public static getBill(id: string): ReactBill | undefined {
    return this.bills.get(id);
  }

  public static updateBill(id: string, updates: Partial<ReactBill>) {
    const bill = this.bills.get(id);
    if (bill) {
      Object.assign(bill, updates);
    }
  }

  public static deleteBill(id: string) {
    this.bills.delete(id);
  }
}

class CycleTransactionsController < ActionController::API
  def create
    payload = cycle_transaction_params
    @cycle_transaction = CycleTransaction.new payload

    if @cycle_transaction.save
      EventsSaveJob.perform_later @cycle_transaction
    end
  end

  private

  def cycle_transaction_params
    params.require(:cycle_transaction).
      permit!
  end
end

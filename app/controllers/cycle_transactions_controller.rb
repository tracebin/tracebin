class CycleTransactionsController < ActionController::API
  def create
    payload = cycle_transaction_params
    @cycle_transaction = CycleTransaction.new payload


    if @cycle_transaction.save
      data = payload[:data]
      create_events(data) if data
    end
  end

  private

  def cycle_transaction_params
    params.require(:cycle_transaction).
      permit!
  end

  def create_events(data)
    data.keys.each do |category|
      category_events = data[category]

      case category
      when 'render_template.action_view'
        category_events.each do |event|
          TemplateEvent.create({
            file: event[:event_payload][:template_file],
            layout: event[:event_payload][:layout],

            start: event[:event_started],
            stop: event[:event_ended],
            duration: event[:event_duration],

            cycle_transaction_id: @cycle_transaction.id
          })
        end
      when 'process_action.action_controller'
        category_events.each do |event|
          ControllerEvent.create({
            format: event[:event_payload][:format],
            controller: event[:event_payload][:controller],
            action: event[:event_payload][:action],
            path: event[:event_payload][:path],

            start: event[:event_started],
            stop: event[:event_ended],
            duration: event[:event_duration],

            cycle_transaction_id: @cycle_transaction.id
          })
        end
      when 'sql.active_record'
        category_events.each do |event|
          SqlEvent.create({
            query: event[:event_payload][:query],

            start: event[:event_started],
            stop: event[:event_ended],
            duration: event[:event_duration],

            cycle_transaction_id: @cycle_transaction.id
          })
        end
      end
    end
  end
end

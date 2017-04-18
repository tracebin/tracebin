class LogSilencer < Rails::Rack::Logger
  def initialize(app, opts = {})
    @app = app
    @opts = opts
    @opts[:silenced] ||= []
    super
  end

  def call(env)
    if env['X-SILENCE-LOGGER'] || @opts[:silenced].include?(env['PATH_INFO'])
      Rials.logger.silence do
        @app.call env
      end
    else
      super env
    end
  end
end

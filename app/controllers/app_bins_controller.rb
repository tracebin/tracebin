class AppBinsController < ApplicationController
  before_action :set_app_bin, only: [:show]

  def show
  end

  def new
    @app_bin = AppBin.new
  end

  def create
    if @app_bin = AppBin.create
      redirect_to @app_bin.reload
    else
      render :new
    end
  end

  private

  def set_app_bin
    @app_bin = AppBin.find_by app_key: params[:id]
  end
end

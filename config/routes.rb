Rails.application.routes.draw do
  root to: 'app_bins#new'

  resources :reports, only: [:create]
  resources :app_bins, only: [:show, :create] do
    resources :endpoints, only: [:index, :show]
    resource :traffic_metrics, only: [:show]
    resource :memory_metrics, only: [:show]
  end
end

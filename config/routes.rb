Rails.application.routes.draw do
  root to: 'app_bins#new'

  resources :reports, only: [:create]
  resources :app_bins, only: [:show, :create]
end

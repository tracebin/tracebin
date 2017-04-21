source 'https://rubygems.org'

git_source(:github) do |repo_name|
  repo_name = "#{repo_name}/#{repo_name}" unless repo_name.include?("/")
  "https://github.com/#{repo_name}.git"
end

# Bundle edge Rails instead: gem 'rails', github: 'rails/rails'
gem 'rails', '~> 5.0.1'
gem 'pg', '~> 0.18'
gem 'puma', '~> 3.0'
gem 'sidekiq'

gem 'haml'
gem 'sass-rails', '~> 5.0'
gem 'uglifier', '>= 1.3.0'
gem 'coffee-rails', '~> 4.2'
gem 'jquery-rails'
gem 'turbolinks', '~> 5'

source 'https://rails-assets.org' do
  gem 'rails-assets-bootstrap', '~>3.3.7'
  gem 'rails-assets-datatables.net'
  gem 'rails-assets-datatables.net-dt'
  gem 'rails-assets-datatables.net-bs'
end

gem 'jbuilder', '~> 2.5'
gem 'redis', '~> 3.0'
gem 'figaro'
# gem 'bcrypt', '~> 3.1.7'

# gem 'vizsla', path: ENV['VIZSLA_DEV_PATH']

# gem 'capistrano-rails', group: :development

group :development, :test do
  gem 'pry'
  gem 'byebug', platform: :mri
end

group :development do
  gem 'web-console', '>= 3.3.0'
  gem 'listen', '~> 3.0.5'
  gem 'spring'
  gem 'spring-watcher-listen', '~> 2.0.0'
end

gem 'tzinfo-data', platforms: [:mingw, :mswin, :x64_mingw, :jruby]

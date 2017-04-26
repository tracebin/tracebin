##
# This is the class for any static pages on the site. Any static page will use
# the +artile+ layout, unless specified here, which is optimized for markdown
# pages. To add a page, add it to +routes.rb+ and add a file to
# +app/views/pages+. For example, the +/story+ route points to
# +app/views/pages/story.html.md+. If you need ERB, add a +.erb+ to the end of
# the filename.
class PagesController < ApplicationController
  layout 'article'
end

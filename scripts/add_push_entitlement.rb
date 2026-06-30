#!/usr/bin/env ruby
# add_push_entitlement.rb  —  give the Flutter Runner target the Push Notifications
# capability (aps-environment) so iOS registers for remote notifications. flutter
# create produces NO entitlements file, so the signed build ships without the push
# entitlement and APNs/FCM never deliver. Run after `flutter create`, before archive.
#
# Usage (cwd = apps/<app>):  ruby ../../scripts/add_push_entitlement.rb . production
require 'xcodeproj'
require 'fileutils'

app_dir   = ARGV[0] || '.'
env       = ARGV[1] || 'production'   # App Store / TestFlight builds use 'production'
proj_path = File.join(app_dir, 'ios', 'Runner.xcodeproj')
ent_rel   = 'Runner/Runner.entitlements' # relative to SRCROOT (the ios/ dir)
ent_full  = File.expand_path(File.join(app_dir, 'ios', ent_rel))

abort("ERROR: #{proj_path} not found") unless File.exist?(proj_path)

# 1. Write the entitlements file (idempotent).
FileUtils.mkdir_p(File.dirname(ent_full))
File.write(ent_full, <<~PLIST)
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
  <dict>
  \t<key>aps-environment</key>
  \t<string>#{env}</string>
  </dict>
  </plist>
PLIST
puts "Wrote #{ent_rel} (aps-environment=#{env})."

project = Xcodeproj::Project.open(proj_path)
target  = project.targets.find { |t| t.name == 'Runner' } or abort('ERROR: Runner target not found')

# 2. Point every build configuration of the Runner target at the entitlements file.
#    The file only needs to exist on disk + be referenced by CODE_SIGN_ENTITLEMENTS;
#    it does not need to be a project group member for signing to pick it up.
target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = ent_rel
end

project.save
puts "OK: Runner target CODE_SIGN_ENTITLEMENTS=#{ent_rel}."

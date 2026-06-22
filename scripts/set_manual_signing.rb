#!/usr/bin/env ruby
# set_manual_signing.rb  —  put manual App Store distribution signing on the Runner
# target ONLY. Frameworks/pods get signed via the command-line identity with no
# profile (frameworks don't need one); only the app target carries the profile.
# A device archive must be distribution-signed (development needs registered devices,
# ad-hoc is banned on the iOS SDK) — and signing the archive is what bakes the
# aps-environment entitlement in so it survives export.
#
# Usage (cwd = apps/<app>):
#   ruby ../../scripts/set_manual_signing.rb . "<profile name>" "<team id>" "<identity>"
require 'xcodeproj'

app_dir, profile, team, identity = ARGV[0] || '.', ARGV[1], ARGV[2], ARGV[3]
abort('usage: set_manual_signing.rb <app_dir> <profile_name> <team_id> <identity>') unless profile && team && identity

proj   = Xcodeproj::Project.open(File.join(app_dir, 'ios', 'Runner.xcodeproj'))
target = proj.targets.find { |t| t.name == 'Runner' } or abort('ERROR: Runner target not found')

target.build_configurations.each do |c|
  c.build_settings['CODE_SIGN_STYLE'] = 'Manual'
  c.build_settings['DEVELOPMENT_TEAM'] = team
  c.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = profile
  c.build_settings['CODE_SIGN_IDENTITY'] = identity
  c.build_settings['CODE_SIGN_IDENTITY[sdk=iphoneos*]'] = identity
end
# also pin the project-level (some Flutter templates read it there)
proj.build_configurations.each do |c|
  c.build_settings['CODE_SIGN_STYLE'] = 'Manual'
  c.build_settings['DEVELOPMENT_TEAM'] = team
end

proj.save
puts "Runner: manual signing — profile='#{profile}', team=#{team}, identity='#{identity}'"

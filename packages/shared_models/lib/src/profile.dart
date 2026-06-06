import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:shared_constants/shared_constants.dart';

part 'profile.freezed.dart';
part 'profile.g.dart';

@freezed
class Profile with _$Profile {
  const factory Profile({
    required String id,
    @JsonKey(name: 'full_name') required String fullName,
    required UserRole role,
    @JsonKey(name: 'shop_id') String? shopId,
    @JsonKey(name: 'fcm_token') String? fcmToken,
    @JsonKey(name: 'is_active') @Default(true) bool isActive,
    @JsonKey(name: 'created_at') required DateTime createdAt,
  }) = _Profile;

  factory Profile.fromJson(Map<String, dynamic> json) => _$ProfileFromJson(json);
}

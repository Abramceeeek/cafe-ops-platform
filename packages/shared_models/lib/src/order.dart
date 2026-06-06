import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:shared_constants/shared_constants.dart';

part 'order.freezed.dart';
part 'order.g.dart';

@freezed
class Order with _$Order {
  const factory Order({
    required String id,
    @JsonKey(name: 'shop_id') required String shopId,
    @JsonKey(name: 'specialist_role') required UserRole specialistRole,
    @JsonKey(name: 'requested_delivery_date') required DateTime requestedDeliveryDate,
    required OrderStatus status,
    @JsonKey(name: 'receipt_id') String? receiptId,
    @JsonKey(name: 'created_at') required DateTime createdAt,
    @JsonKey(name: 'specialist_approved_at') DateTime? specialistApprovedAt,
    @JsonKey(name: 'shop_confirmed_at') DateTime? shopConfirmedAt,
    @JsonKey(name: 'in_progress_at') DateTime? inProgressAt,
    @JsonKey(name: 'packaged_at') DateTime? packagedAt,
    @JsonKey(name: 'ready_at') DateTime? readyAt,
    @JsonKey(name: 'delivered_at') DateTime? deliveredAt,
  }) = _Order;

  factory Order.fromJson(Map<String, dynamic> json) => _$OrderFromJson(json);
}

@freezed
class OrderItem with _$OrderItem {
  const factory OrderItem({
    required String id,
    @JsonKey(name: 'order_id') required String orderId,
    @JsonKey(name: 'product_id') required String productId,
    required num quantity,
    @JsonKey(name: 'unit_cost') num? unitCost,
    @JsonKey(name: 'custom_note') String? customNote,
  }) = _OrderItem;

  factory OrderItem.fromJson(Map<String, dynamic> json) => _$OrderItemFromJson(json);
}

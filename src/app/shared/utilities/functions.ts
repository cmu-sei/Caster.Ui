export function isUpdate<T>(obj: any): obj is T {
  return !(
    Object.keys(obj).length === 0 &&
    Object.getPrototypeOf(obj).constructor === Object.prototype.constructor
  );
}

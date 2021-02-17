// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
export function isUpdate<T>(obj: any): obj is T {
  return !(
    Object.keys(obj).length === 0 &&
    Object.getPrototypeOf(obj).constructor === Object.prototype.constructor
  );
}

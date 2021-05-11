/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

/**
 * Caster API
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: v1.1.0
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */
import { VariableValue } from './variableValue';

export interface CreateSnippetCommand {
  /**
   * ID of the Version.
   */
  versionId?: string;
  /**
   * Name for this instance of the Module.
   */
  moduleName?: string | null;
  /**
   * Variables of the Module.
   */
  variableValues?: Array<VariableValue> | null;
}

import { getMcpResourceMetadataUrl } from "@/lib/app-url";

export function getMcpWwwAuthenticate(currentOrigin?: string) {
  return `Bearer realm="moniq", resource_metadata="${getMcpResourceMetadataUrl(currentOrigin)}"`;
}

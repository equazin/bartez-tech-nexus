import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { logger } from "@/lib/logger";
import { Tienda } from "@/components/tienda/Tienda";
import { NoEncontrado } from "@/components/tienda/NoEncontrado";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    logger.error("404: dirección inexistente", location.pathname);
  }, [location.pathname]);

  return (
    <Tienda>
      <NoEncontrado />
    </Tienda>
  );
};

export default NotFound;
